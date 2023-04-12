import { IQueueManager, IQueue, IQueueMessage } from "interfaces";
export declare class QueueManager implements IQueueManager {
    createQueue(queueName: string): Promise<IQueue>;
    getQueue(queueName: string): Promise<IQueue>;
    listQueues(prefix?: string): Promise<IQueue[]>;
}
export declare class Queue implements IQueue {
    name: string;
    private url;
    constructor(name: string, url: string);
    sendMessage(message: any): Promise<void>;
    receiveMessages(num?: number, timeoutSeconds?: number): Promise<IQueueMessage[]>;
    delete(): Promise<void>;
}
export declare class QueueMessage implements IQueueMessage {
    body: any;
    private queueUrl;
    private receiptHandle;
    constructor(body: any, queueUrl: string, receiptHandle: string);
    delete(): Promise<void>;
}
