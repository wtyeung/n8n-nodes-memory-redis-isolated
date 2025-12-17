"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryRedisIsolated = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const redis_1 = require("@langchain/redis");
const memory_1 = require("@langchain/classic/memory");
const redis_2 = require("redis");
const crypto = __importStar(require("crypto"));
class MemoryRedisIsolated {
    constructor() {
        this.usableAsTool = false;
        this.description = {
            displayName: 'Redis Chat Memory (Isolated)',
            name: 'memoryRedisIsolated',
            icon: 'file:redis.svg',
            group: ['transform'],
            version: 1,
            subtitle: 'User Isolation for Queue Mode',
            description: 'Stores chat history in Redis with user isolation for queue mode',
            defaults: {
                name: 'Redis Chat Memory (Isolated)',
            },
            credentials: [
                {
                    name: 'redisMemoryIsolated',
                    required: false,
                },
            ],
            codex: {
                categories: ['AI'],
                subcategories: {
                    AI: ['Memory'],
                    Memory: ['Other memories'],
                },
                alias: ['redis', 'cache', 'memory', 'chat history'],
                resources: {
                    primaryDocumentation: [
                        {
                            url: 'https://github.com/wtyeung/n8n-nodes-memory-redis-isolated#readme',
                        },
                    ],
                },
            },
            inputs: [],
            outputs: [n8n_workflow_1.NodeConnectionTypes.AiMemory],
            outputNames: ['Memory'],
            properties: [
                {
                    displayName: '',
                    name: 'notice',
                    type: 'notice',
                    default: '',
                    displayOptions: {
                        show: {
                            '@version': [{ _cnd: { lte: 1 } }],
                        },
                    },
                },
                {
                    displayName: 'Use Queue Mode Redis',
                    name: 'useQueueRedis',
                    type: 'boolean',
                    default: true,
                    description: 'Whether to use the queue mode Redis configuration (QUEUE_BULL_REDIS_* environment variables). When enabled, this overrides any credentials provided above. Chat memory will be stored in database (QUEUE_BULL_REDIS_DB + 1) to avoid conflicts with queue data.',
                },
                {
                    displayName: 'Session ID',
                    name: 'sessionId',
                    type: 'string',
                    default: '={{ $json.sessionId }}',
                    required: true,
                    description: 'Session identifier for the conversation',
                    placeholder: 'e.g., session456 or {{ $json.sessionId }}',
                },
                {
                    displayName: 'Context Window Length',
                    name: 'contextWindowLength',
                    type: 'number',
                    default: 10,
                    description: 'Number of previous messages to keep in memory',
                    displayOptions: {
                        show: {},
                    },
                },
                {
                    displayName: 'Session Time To Live (Seconds)',
                    name: 'sessionTTL',
                    type: 'number',
                    default: 86400,
                    typeOptions: {
                        maxValue: 86400,
                        minValue: 1,
                    },
                    description: 'How long the session should be stored in seconds. Default and maximum is 86400 (24 hours). Minimum is 1 second.',
                },
            ],
            usableAsTool: true,
        };
    }
    async supplyData(itemIndex) {
        const useQueueRedis = this.getNodeParameter('useQueueRedis', itemIndex, true);
        const sessionId = this.getNodeParameter('sessionId', itemIndex);
        const sessionTTL = this.getNodeParameter('sessionTTL', itemIndex, 0);
        const contextWindowLength = this.getNodeParameter('contextWindowLength', itemIndex, 10);
        const workflowId = this.getWorkflow().id;
        if (!sessionId || sessionId.trim() === '') {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Session ID is required for memory storage');
        }
        const userHash = crypto.createHash('sha256').update(`${workflowId}`).digest('hex').substring(0, 10);
        const isolatedSessionKey = `${userHash}:${sessionId}`;
        let redisOptions;
        if (!useQueueRedis) {
            const credentials = await this.getCredentials('redisMemoryIsolated');
            if (!credentials) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Credentials are required when "Use Queue Redis" is disabled');
            }
            redisOptions = {
                socket: {
                    host: credentials.host,
                    port: credentials.port,
                    tls: credentials.ssl === true,
                },
                database: credentials.database,
            };
            if (credentials.user) {
                redisOptions.username = credentials.user;
            }
            if (credentials.password) {
                redisOptions.password = credentials.password;
            }
        }
        else {
            const queueHost = process.env.QUEUE_BULL_REDIS_HOST || 'localhost';
            const queuePort = parseInt(process.env.QUEUE_BULL_REDIS_PORT || '6379', 10);
            const queueDb = parseInt(process.env.QUEUE_BULL_REDIS_DB || '0', 10);
            const queueUsername = process.env.QUEUE_BULL_REDIS_USERNAME;
            const queuePassword = process.env.QUEUE_BULL_REDIS_PASSWORD;
            redisOptions = {
                socket: {
                    host: queueHost,
                    port: queuePort,
                },
                database: queueDb + 1,
            };
            if (queueUsername) {
                redisOptions.username = queueUsername;
            }
            if (queuePassword) {
                redisOptions.password = queuePassword;
            }
        }
        const client = (0, redis_2.createClient)({
            ...redisOptions,
        });
        client.on('error', async (error) => {
            await client.quit();
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Redis Error: ' + error.message);
        });
        const redisChatConfig = {
            client,
            sessionId: isolatedSessionKey,
        };
        if (sessionTTL > 0) {
            redisChatConfig.sessionTTL = sessionTTL;
        }
        const redisChatHistory = new redis_1.RedisChatMessageHistory(redisChatConfig);
        const memory = new memory_1.BufferWindowMemory({
            memoryKey: 'chat_history',
            chatHistory: redisChatHistory,
            returnMessages: true,
            inputKey: 'input',
            outputKey: 'output',
            k: contextWindowLength,
        });
        async function closeFunction() {
            void client.disconnect();
        }
        return {
            closeFunction,
            response: memory,
        };
    }
}
exports.MemoryRedisIsolated = MemoryRedisIsolated;
//# sourceMappingURL=MemoryRedisIsolated.node.js.map