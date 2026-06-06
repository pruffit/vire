import { Queue } from 'bullmq';
import { QUEUE_TRANSCODE, QUEUE_PLAY_EVENTS, QUEUE_NOTIFY_RELEASE, type TranscodeJobData, type PlayEventJobData, type NotifyReleaseJobData } from '@vire/core';

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

const globalForPlayQueue = globalThis as unknown as { _playEventQueue?: PlayEventQueue };

class PlayEventQueue {
  private q = new Queue<PlayEventJobData>(QUEUE_PLAY_EVENTS, {
    connection: {
      url: process.env.REDIS_URL ?? 'redis://localhost:6379',
      maxRetriesPerRequest: null as unknown as number,
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2_000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 100 },
    },
  });

  async add(data: PlayEventJobData): Promise<void> {
    await this.q.add('play-event', data);
  }
}

export const playEventQueue: PlayEventQueue =
  globalForPlayQueue._playEventQueue ?? new PlayEventQueue();

if (process.env.NODE_ENV !== 'production') {
  globalForPlayQueue._playEventQueue = playEventQueue;
}

const globalForNotify = globalThis as unknown as { _notifyReleaseQueue?: NotifyReleaseQueue };

class NotifyReleaseQueue {
  private q = new Queue<NotifyReleaseJobData>(QUEUE_NOTIFY_RELEASE, {
    connection: {
      url: process.env.REDIS_URL ?? 'redis://localhost:6379',
      maxRetriesPerRequest: null as unknown as number,
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });

  async add(data: NotifyReleaseJobData): Promise<void> {
    await this.q.add('notify-release', data);
  }
}

export const notifyReleaseQueue: NotifyReleaseQueue =
  globalForNotify._notifyReleaseQueue ?? new NotifyReleaseQueue();

if (process.env.NODE_ENV !== 'production') {
  globalForNotify._notifyReleaseQueue = notifyReleaseQueue;
}
