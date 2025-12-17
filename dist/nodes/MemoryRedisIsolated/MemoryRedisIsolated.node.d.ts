import { type INodeType, type INodeTypeDescription, type ISupplyDataFunctions, type SupplyData } from 'n8n-workflow';
export declare class MemoryRedisIsolated implements INodeType {
    usableAsTool: boolean;
    description: INodeTypeDescription;
    supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData>;
}
