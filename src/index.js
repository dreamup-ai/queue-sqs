"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueMessage = exports.Queue = exports.QueueManager = void 0;
const client_sqs_1 = require("@aws-sdk/client-sqs");
const { AWS_REGION, AWS_DEFAULT_REGION, SQS_ENDPOINT } = process.env;
const sqs = new client_sqs_1.SQSClient({
    region: AWS_REGION || AWS_DEFAULT_REGION,
    endpoint: SQS_ENDPOINT,
});
class QueueManager {
    createQueue(queueName, opts = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const Attributes = {};
                if (opts.visibilityTimeoutSeconds) {
                    Attributes.VisibilityTimeout = opts.visibilityTimeoutSeconds.toString();
                }
                if (opts.fifo || queueName.endsWith(".fifo")) {
                    Attributes.FifoQueue = "true";
                    if (!queueName.endsWith(".fifo")) {
                        queueName += ".fifo";
                    }
                }
                if (opts.delaySeconds) {
                    Attributes.DelaySeconds = opts.delaySeconds.toString();
                }
                if (opts.deadLetterQueue) {
                    try {
                        const dlq = yield this.getQueue(opts.deadLetterQueue);
                        const { Attributes } = yield sqs.send(new client_sqs_1.GetQueueAttributesCommand({
                            QueueUrl: dlq.getUrl(),
                            AttributeNames: ["QueueArn"],
                        }));
                        if (!Attributes || !Attributes.QueueArn) {
                            throw new Error("Queue ARN not found");
                        }
                        Attributes.RedrivePolicy = JSON.stringify({
                            deadLetterTargetArn: Attributes.QueueArn,
                            maxReceiveCount: opts.maxReceiveCount || 1,
                        });
                    }
                    catch (e) {
                        throw new Error(`Dead letter queue not found: ${e.message}`);
                    }
                }
                if (opts.encrypted) {
                    Attributes.SqsManagedSseEnabled = "true";
                }
                if (opts.messageRetentionSeconds) {
                    Attributes.MessageRetentionPeriod =
                        opts.messageRetentionSeconds.toString();
                }
                if (opts.receiveMessageWaitTimeSeconds) {
                    Attributes.ReceiveMessageWaitTimeSeconds =
                        opts.receiveMessageWaitTimeSeconds.toString();
                }
                const result = yield sqs.send(new client_sqs_1.CreateQueueCommand({
                    QueueName: queueName,
                    Attributes,
                }));
                if (result.QueueUrl) {
                    return new Queue(queueName, result.QueueUrl);
                }
                else {
                    throw new Error("Queue URL not found");
                }
            }
            catch (error) {
                throw error;
            }
        });
    }
    getQueue(queueName) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield sqs.send(new client_sqs_1.GetQueueUrlCommand({
                    QueueName: queueName,
                }));
                if (result.QueueUrl) {
                    return new Queue(queueName, result.QueueUrl);
                }
                else {
                    throw new Error("Queue URL not found");
                }
            }
            catch (error) {
                throw error;
            }
        });
    }
    listQueues(prefix) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const urls = [];
                let nextToken;
                do {
                    const result = yield sqs.send(new client_sqs_1.ListQueuesCommand({
                        QueueNamePrefix: prefix,
                        NextToken: nextToken,
                    }));
                    if (result.QueueUrls) {
                        urls.push(...result.QueueUrls);
                    }
                    nextToken = result.NextToken;
                } while (nextToken);
                return urls.map((url) => {
                    const name = url.split("/").pop();
                    if (name) {
                        return new Queue(name, url);
                    }
                    else {
                        throw new Error("Queue name not found");
                    }
                });
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.QueueManager = QueueManager;
class Queue {
    constructor(name, url) {
        this.name = name;
        this.url = url;
    }
    sendMessage(message) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof message !== "string") {
                message = JSON.stringify(message);
            }
            try {
                yield sqs.send(new client_sqs_1.SendMessageCommand({
                    QueueUrl: this.url,
                    MessageBody: message,
                }));
            }
            catch (e) {
                throw e;
            }
        });
    }
    receiveMessages(num = 1, timeoutSeconds = 5) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield sqs.send(new client_sqs_1.ReceiveMessageCommand({
                    QueueUrl: this.url,
                    MaxNumberOfMessages: num,
                    WaitTimeSeconds: timeoutSeconds,
                }));
                if (result.Messages) {
                    return result.Messages.map((message) => new QueueMessage(JSON.parse(message.Body), this.url, message.ReceiptHandle));
                }
                else {
                    return [];
                }
            }
            catch (e) {
                throw e;
            }
        });
    }
    delete() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield sqs.send(new client_sqs_1.DeleteQueueCommand({
                    QueueUrl: this.url,
                }));
            }
            catch (e) {
                throw e;
            }
        });
    }
    getUrl() {
        return this.url;
    }
}
exports.Queue = Queue;
class QueueMessage {
    constructor(body, queueUrl, receiptHandle) {
        this.body = body;
        this.queueUrl = queueUrl;
        this.receiptHandle = receiptHandle;
    }
    delete() {
        return __awaiter(this, void 0, void 0, function* () {
            yield sqs.send(new client_sqs_1.DeleteMessageCommand({
                QueueUrl: this.queueUrl,
                ReceiptHandle: this.receiptHandle,
            }));
        });
    }
}
exports.QueueMessage = QueueMessage;
