import {
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';
import { RedisChatMessageHistory, type RedisChatMessageHistoryInput } from '@langchain/redis';
import { BufferWindowMemory } from '@langchain/classic/memory';
import { createClient, type RedisClientOptions } from 'redis';
import * as crypto from 'crypto';

export class MemoryRedisIsolated implements INodeType {
	usableAsTool = false;
	description: INodeTypeDescription = {
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
				displayOptions: {
					show: {},
				},
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
		outputs: [NodeConnectionTypes.AiMemory],
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
				displayName: 'Credentials are optional. If not provided, the node will use queue Redis environment variables (QUEUE_BULL_REDIS_*) with database number + 1.',
				name: 'credentialsNotice',
				type: 'notice',
				default: '',
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
				description:
					'How long the session should be stored in seconds. Default and maximum is 86400 (24 hours). Minimum is 1 second.',
			},
		],
		usableAsTool: true,
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		let credentials;
		try {
			credentials = await this.getCredentials('redisMemoryIsolated');
		} catch (error) {
			// Credentials not defined, will use environment variables
			credentials = null;
		}

		const sessionId = this.getNodeParameter('sessionId', itemIndex) as string;
		const sessionTTL = this.getNodeParameter('sessionTTL', itemIndex, 0) as number;
		const contextWindowLength = this.getNodeParameter('contextWindowLength', itemIndex, 10) as number;
		const workflowId = this.getWorkflow().id;

		if (!sessionId || sessionId.trim() === '') {
			throw new NodeOperationError(
				this.getNode(),
				'Session ID is required for memory storage',
			);
		}

		// Hash the workflow ID and take first 10 characters for isolation
		// This ensures data is isolated per workflow
		const userHash = crypto.createHash('sha256').update(`${workflowId}`).digest('hex').substring(0, 10);
		
		// Create isolated session key: userHash:sessionId
		const isolatedSessionKey = `${userHash}:${sessionId}`;

		let redisOptions: RedisClientOptions;

		if (credentials) {
			// Use provided credentials
			redisOptions = {
				socket: {
					host: credentials.host as string,
					port: credentials.port as number,
					tls: credentials.ssl === true,
				},
				database: credentials.database as number,
			};

			if (credentials.user) {
				redisOptions.username = credentials.user as string;
			}
			if (credentials.password) {
				redisOptions.password = credentials.password as string;
			}
		} else {
			// Use queue Redis environment variables
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
				// Use queue database + 1 to avoid conflicts
				database: queueDb + 1,
			};

			if (queueUsername) {
				redisOptions.username = queueUsername;
			}
			if (queuePassword) {
				redisOptions.password = queuePassword;
			}
		}

		const client = createClient({
			...redisOptions,
		});

		client.on('error', async (error: Error) => {
			await client.quit();
			throw new NodeOperationError(this.getNode(), 'Redis Error: ' + error.message);
		});

		const redisChatConfig: RedisChatMessageHistoryInput = {
			client,
			sessionId: isolatedSessionKey,
		};

		if (sessionTTL > 0) {
			redisChatConfig.sessionTTL = sessionTTL;
		}

		const redisChatHistory = new RedisChatMessageHistory(redisChatConfig);

		const memory = new BufferWindowMemory({
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
