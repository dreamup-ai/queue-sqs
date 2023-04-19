import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  CreateQueueCommand,
  ListQueuesCommand,
  GetQueueUrlCommand,
  DeleteQueueCommand,
  QueueAttributeName,
  GetQueueAttributesCommand,
} from "@aws-sdk/client-sqs";
import { IQueueManager, IQueue, IQueueMessage, QueueOptions } from "interfaces";

const { AWS_REGION, AWS_DEFAULT_REGION, SQS_ENDPOINT } = process.env;

const sqs = new SQSClient({
  region: AWS_REGION || AWS_DEFAULT_REGION,
  endpoint: SQS_ENDPOINT,
});

export class QueueManager implements IQueueManager {
  async createQueue(
    queueName: string,
    opts: QueueOptions = {}
  ): Promise<Queue> {
    try {
      const Attributes: { [K in QueueAttributeName]?: string } = {};

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
          const dlq = await this.getQueue(opts.deadLetterQueue);
          const { Attributes } = await sqs.send(
            new GetQueueAttributesCommand({
              QueueUrl: dlq.getUrl(),
              AttributeNames: ["QueueArn"],
            })
          );
          if (!Attributes || !Attributes.QueueArn) {
            throw new Error("Queue ARN not found");
          }
          Attributes.RedrivePolicy = JSON.stringify({
            deadLetterTargetArn: Attributes.QueueArn,
            maxReceiveCount: opts.maxReceiveCount || 1,
          });
        } catch (e: any) {
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

      const result = await sqs.send(
        new CreateQueueCommand({
          QueueName: queueName,
          Attributes,
        })
      );
      if (result.QueueUrl) {
        return new Queue(queueName, result.QueueUrl);
      } else {
        throw new Error("Queue URL not found");
      }
    } catch (error) {
      throw error;
    }
  }

  async getQueue(queueName: string): Promise<Queue> {
    try {
      const result = await sqs.send(
        new GetQueueUrlCommand({
          QueueName: queueName,
        })
      );
      if (result.QueueUrl) {
        return new Queue(queueName, result.QueueUrl);
      } else {
        throw new Error("Queue URL not found");
      }
    } catch (error) {
      throw error;
    }
  }

  async listQueues(prefix?: string): Promise<Queue[]> {
    try {
      const urls = [];
      let nextToken: string | undefined;
      do {
        const result = await sqs.send(
          new ListQueuesCommand({
            QueueNamePrefix: prefix,
            NextToken: nextToken,
          })
        );
        if (result.QueueUrls) {
          urls.push(...result.QueueUrls);
        }
        nextToken = result.NextToken;
      } while (nextToken);

      return urls.map((url) => {
        const name = url.split("/").pop();
        if (name) {
          return new Queue(name, url);
        } else {
          throw new Error("Queue name not found");
        }
      });
    } catch (error) {
      throw error;
    }
  }
}

export class Queue implements IQueue {
  public name: string;
  private url: string;

  constructor(name: string, url: string) {
    this.name = name;
    this.url = url;
  }

  async sendMessage(message: any): Promise<void> {
    if (typeof message !== "string") {
      message = JSON.stringify(message);
    }
    try {
      await sqs.send(
        new SendMessageCommand({
          QueueUrl: this.url,
          MessageBody: message,
        })
      );
    } catch (e: any) {
      throw e;
    }
  }

  async receiveMessages(
    num: number = 1,
    timeoutSeconds: number = 5
  ): Promise<IQueueMessage[]> {
    try {
      const result = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: this.url,
          MaxNumberOfMessages: num,
          WaitTimeSeconds: timeoutSeconds,
        })
      );
      if (result.Messages) {
        return result.Messages.map(
          (message) =>
            new QueueMessage(
              JSON.parse(message.Body!),
              this.url,
              message.ReceiptHandle!
            )
        );
      } else {
        return [];
      }
    } catch (e: any) {
      throw e;
    }
  }

  async delete(): Promise<void> {
    try {
      await sqs.send(
        new DeleteQueueCommand({
          QueueUrl: this.url,
        })
      );
    } catch (e: any) {
      throw e;
    }
  }

  getUrl(): string {
    return this.url;
  }
}

export class QueueMessage implements IQueueMessage {
  body: any;
  private queueUrl: string;
  private receiptHandle: string;

  constructor(body: any, queueUrl: string, receiptHandle: string) {
    this.body = body;
    this.queueUrl = queueUrl;
    this.receiptHandle = receiptHandle;
  }

  async delete(): Promise<void> {
    await sqs.send(
      new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: this.receiptHandle,
      })
    );
  }
}
