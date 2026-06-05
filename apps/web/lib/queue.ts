import { Queue } from 'bullmq';
import { QUEUE_TRANSCODE, type TranscodeJobData } from '@vire/core';

// Синглтон — переиспользуется между запросами в рамках процесса Next.js
const globalForQueue = globalThis as unknown as { _transcodeQueue?: TranscodeQueue };

class TranscodeQueue {
  private q = new Queue<TranscodeJobData>(QUEUE_TRANSCODE, {
    connection: {
      url: process.env.REDIS_URL ?? 'redis://localhost:6379',
      maxRetriesPerRequest: null as unknown as number,
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });

  async add(data: TranscodeJobData): Promise<void> {
    await this.q.add('transcode', data);
  }
}

export const transcodeQueue: TranscodeQueue =
  globalForQueue._transcodeQueue ?? new TranscodeQueue();

if (process.env.NODE_ENV !== 'production') {
  globalForQueue._transcodeQueue = transcodeQueue;
}
