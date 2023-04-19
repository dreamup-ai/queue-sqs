import { IQueueManager, IQueue, IQueueMessage, QueueOptions } from "interfaces";
export declare class QueueManager implements IQueueManager {
    createQueue(queueName: string, opts?: QueueOptions): Promise<Queue>;
    getQueue(queueName: string): Promise<Queue>;
    listQueues(prefix?: string): Promise<Queue[]>;
}
export declare class Queue implements IQueue {
    name: string;
    private url;
    constructor(name: string, url: string);
    sendMessage(message: any): Promise<void>;
    receiveMessages(num?: number, timeoutSeconds?: number): Promise<IQueueMessage[]>;
    delete(): Promise<void>;
    getUrl(): string;
}
export declare class QueueMessage implements IQueueMessage {
    body: any;
    private queueUrl;
    private receiptHandle;
    constructor(body: any, queueUrl: string, receiptHandle: string);
    delete(): Promise<void>;
}
