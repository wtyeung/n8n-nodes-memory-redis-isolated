import type { ICredentialType, INodeProperties } from 'n8n-workflow';
export declare class RedisMemoryIsolated implements ICredentialType {
    name: string;
    displayName: string;
    documentationUrl: string;
    icon: "file:redis.svg";
    test: {
        request: {
            baseURL: string;
        };
    };
    properties: INodeProperties[];
}
