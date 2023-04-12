import { expect } from "chai";
import { QueueManager } from "../src/index";
import {
  SQSClient,
  ListQueuesCommand,
  DeleteQueueCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import { IQueue } from "interfaces";

const { AWS_REGION, AWS_DEFAULT_REGION, SQS_ENDPOINT } = process.env;
const sqs = new SQSClient({
  region: AWS_REGION || AWS_DEFAULT_REGION,
  endpoint: SQS_ENDPOINT,
});

async function clearAllQueues() {
  const queues = await sqs.send(new ListQueuesCommand({}));
  if (queues.QueueUrls) {
    for (const url of queues.QueueUrls) {
      await sqs.send(new DeleteQueueCommand({ QueueUrl: url }));
    }
  }
}

const queueManager = new QueueManager();

beforeEach(async () => {
  await clearAllQueues();
});

describe("QueueManager", () => {
  describe("createQueue", () => {
    it("should create a queue", async () => {
      const queue = await queueManager.createQueue("test-queue");
      expect(queue).to.not.be.undefined;
      expect(queue.name).to.equal("test-queue");
    });
  });

  describe("getQueue", () => {
    it("should get a queue", async () => {
      await queueManager.createQueue("test-queue");
      const queue = await queueManager.getQueue("test-queue");
      expect(queue).to.not.be.undefined;
      expect(queue.name).to.equal("test-queue");
    });
  });

  describe("listQueues", () => {
    it("should list queues", async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(queueManager.createQueue(`test-queue-${i}`));
      }
      await Promise.all(promises);
      const queues = await queueManager.listQueues();
      expect(queues).to.not.be.undefined;
      expect(queues).to.have.lengthOf(10);
      expect(queues[0].name).to.equal("test-queue-0");
    });

    it("should list queues with prefix", async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(queueManager.createQueue(`test-queue-${i}`));
      }
      await Promise.all(promises);
      const queues = await queueManager.listQueues("test-queue-1");
      expect(queues).to.not.be.undefined;
      expect(queues).to.have.lengthOf(1);
      expect(queues[0].name).to.equal("test-queue-1");
    });
  });
});

describe("Queue", () => {
  let queue: IQueue;

  beforeEach(async () => {
    queue = await queueManager.createQueue("test-queue");
  });

  describe("sendMessage", () => {
    it("should send a message", async () => {
      await queue.sendMessage({ hello: "world" });
      const result = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: "http://localhost:4566/000000000000/test-queue",
        })
      );
      expect(result.Messages).to.not.be.undefined;
      expect(result.Messages).to.have.lengthOf(1);
      expect(result.Messages![0].Body).to.equal('{"hello":"world"}');
      await sqs.send(
        new DeleteMessageCommand({
          QueueUrl: "http://localhost:4566/000000000000/test-queue",
          ReceiptHandle: result.Messages![0].ReceiptHandle!,
        })
      );
    });
  });

  describe("receiveMessages", () => {
    it("should receive a message", async () => {
      await queue.sendMessage({ hello: "world" });
      const messages = await queue.receiveMessages(1, 1);
      expect(messages).to.not.be.undefined;
      expect(messages).to.have.lengthOf(1);
      expect(messages[0].body).to.deep.equal({ hello: "world" });
      await messages[0].delete();
    });
  });

  describe("delete", () => {
    it("should delete a queue", async () => {
      await queue.delete();
      const queues = await queueManager.listQueues();
      expect(queues).to.have.lengthOf(0);
    });
  });
});
