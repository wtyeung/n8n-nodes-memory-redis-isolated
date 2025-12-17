import {
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';
import { RedisChatMessageHistory, type RedisChatMessageHistoryInput } from '@langchain/redis';
import { BufferWindowMemory } from 'langchain/memory';
import { createClient, type RedisClientOptions } from 'redis';
import * as crypto from 'crypto';

export class MemoryRedisIsolated implements INodeType {
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
				required: true,
			},
		],
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Memory'],
				Memory: ['Other memories'],
			},
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
				displayName: 'User ID',
				name: 'userId',
				type: 'string',
				default: '={{ $json.userId }}',
				required: true,
				description: 'Unique identifier for the user. Will be hashed for isolation.',
				placeholder: 'e.g., user123 or {{ $json.userId }}',
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
				displayName: 'Session Time To Live',
				name: 'sessionTTL',
				type: 'number',
				default: 0,
				description:
					'For how long the session should be stored in seconds. If set to 0 it will not expire.',
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const credentials = await this.getCredentials('redisMemoryIsolated');

		const userId = this.getNodeParameter('userId', itemIndex) as string;
		const sessionId = this.getNodeParameter('sessionId', itemIndex) as string;
		const sessionTTL = this.getNodeParameter('sessionTTL', itemIndex, 0) as number;
		const contextWindowLength = this.getNodeParameter('contextWindowLength', itemIndex, 10) as number;
		const workflowId = this.getWorkflow().id;

		if (!userId || userId.trim() === '') {
			throw new NodeOperationError(
this.getNode(),
				'User ID is required for isolated memory storage',
			);
		}

		if (!sessionId || sessionId.trim() === '') {
			throw new NodeOperationError(
this.getNode(),
				'Session ID is required for memory storage',
			);
		}

		// Hash the user ID and take first 10 characters for isolation
		// Include workflow ID to prevent cross-workflow access
		const userHash = crypto.createHash('sha256').update(`${workflowId}:${userId}`).digest('hex').substring(0, 10);
		
		// Create isolated session key: userHash:sessionId
		const isolatedSessionKey = `${userHash}:${sessionId}`;

		const redisOptions: RedisClientOptions = {
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

		const client = createClient({
...redisOptions,
});

		try {
			await client.connect();
		} catch (error) {
			throw new NodeOperationError(
this.getNode(),
				'Failed to connect to Redis: ' + (error as Error).message,
			);
		}

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
