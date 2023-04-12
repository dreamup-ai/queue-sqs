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
const chai_1 = require("chai");
const index_1 = require("../src/index");
const client_sqs_1 = require("@aws-sdk/client-sqs");
const { AWS_REGION, AWS_DEFAULT_REGION, SQS_ENDPOINT } = process.env;
const sqs = new client_sqs_1.SQSClient({
    region: AWS_REGION || AWS_DEFAULT_REGION,
    endpoint: SQS_ENDPOINT,
});
function clearAllQueues() {
    return __awaiter(this, void 0, void 0, function* () {
        const queues = yield sqs.send(new client_sqs_1.ListQueuesCommand({}));
        if (queues.QueueUrls) {
            for (const url of queues.QueueUrls) {
                yield sqs.send(new client_sqs_1.DeleteQueueCommand({ QueueUrl: url }));
            }
        }
    });
}
const queueManager = new index_1.QueueManager();
beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
    yield clearAllQueues();
}));
describe("QueueManager", () => {
    describe("createQueue", () => {
        it("should create a queue", () => __awaiter(void 0, void 0, void 0, function* () {
            const queue = yield queueManager.createQueue("test-queue");
            (0, chai_1.expect)(queue).to.not.be.undefined;
            (0, chai_1.expect)(queue.name).to.equal("test-queue");
        }));
    });
    describe("getQueue", () => {
        it("should get a queue", () => __awaiter(void 0, void 0, void 0, function* () {
            yield queueManager.createQueue("test-queue");
            const queue = yield queueManager.getQueue("test-queue");
            (0, chai_1.expect)(queue).to.not.be.undefined;
            (0, chai_1.expect)(queue.name).to.equal("test-queue");
        }));
    });
    describe("listQueues", () => {
        it("should list queues", () => __awaiter(void 0, void 0, void 0, function* () {
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(queueManager.createQueue(`test-queue-${i}`));
            }
            yield Promise.all(promises);
            const queues = yield queueManager.listQueues();
            (0, chai_1.expect)(queues).to.not.be.undefined;
            (0, chai_1.expect)(queues).to.have.lengthOf(10);
            (0, chai_1.expect)(queues[0].name).to.equal("test-queue-0");
        }));
        it("should list queues with prefix", () => __awaiter(void 0, void 0, void 0, function* () {
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(queueManager.createQueue(`test-queue-${i}`));
            }
            yield Promise.all(promises);
            const queues = yield queueManager.listQueues("test-queue-1");
            (0, chai_1.expect)(queues).to.not.be.undefined;
            (0, chai_1.expect)(queues).to.have.lengthOf(1);
            (0, chai_1.expect)(queues[0].name).to.equal("test-queue-1");
        }));
    });
});
describe("Queue", () => {
    let queue;
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        queue = yield queueManager.createQueue("test-queue");
    }));
    describe("sendMessage", () => {
        it("should send a message", () => __awaiter(void 0, void 0, void 0, function* () {
            yield queue.sendMessage({ hello: "world" });
            const result = yield sqs.send(new client_sqs_1.ReceiveMessageCommand({
                QueueUrl: "http://localhost:4566/000000000000/test-queue",
            }));
            (0, chai_1.expect)(result.Messages).to.not.be.undefined;
            (0, chai_1.expect)(result.Messages).to.have.lengthOf(1);
            (0, chai_1.expect)(result.Messages[0].Body).to.equal('{"hello":"world"}');
            yield sqs.send(new client_sqs_1.DeleteMessageCommand({
                QueueUrl: "http://localhost:4566/000000000000/test-queue",
                ReceiptHandle: result.Messages[0].ReceiptHandle,
            }));
        }));
    });
    describe("receiveMessages", () => {
        it("should receive a message", () => __awaiter(void 0, void 0, void 0, function* () {
            yield queue.sendMessage({ hello: "world" });
            const messages = yield queue.receiveMessages(1, 1);
            (0, chai_1.expect)(messages).to.not.be.undefined;
            (0, chai_1.expect)(messages).to.have.lengthOf(1);
            (0, chai_1.expect)(messages[0].body).to.deep.equal({ hello: "world" });
            yield messages[0].delete();
        }));
    });
    describe("delete", () => {
        it("should delete a queue", () => __awaiter(void 0, void 0, void 0, function* () {
            yield queue.delete();
            const queues = yield queueManager.listQueues();
            (0, chai_1.expect)(queues).to.have.lengthOf(0);
        }));
    });
});
