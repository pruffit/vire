import { Queue } from 'bullmq';
import { QUEUE_TRANSCODE, QUEUE_PLAY_EVENTS, QUEUE_NOTIFY_RELEASE, QUEUE_ANALYZE, QUEUE_ANALYZE_GENRE, type TranscodeJobData, type PlayEventJobData, type NotifyReleaseJobData, type AnalyzeJobData, type AnalyzeGenreJobData } from '@vire/core';

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

const globalForAnalyze = globalThis as unknown as { _analyzeQueue?: AnalyzeQueue };

class AnalyzeQueue {
  private q = new Queue<AnalyzeJobData>(QUEUE_ANALYZE, {
    connection: {
      url: process.env.REDIS_URL ?? 'redis://localhost:6379',
      maxRetriesPerRequest: null as unknown as number,
    },
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 50 },
    },
  });

  // deduplication.id (не фиксированный jobId) — снимается по завершении/провалу джобы;
  // jobId остался бы занят в completed/failed, и повторный .add() тихо вернул бы старую джобу.
  async add(data: AnalyzeJobData): Promise<void> {
    await this.q.add('analyze-audio', data, { deduplication: { id: `analyze:${data.trackId}` } });
  }
}

export const analyzeQueue: AnalyzeQueue =
  globalForAnalyze._analyzeQueue ?? new AnalyzeQueue();

if (process.env.NODE_ENV !== 'production') {
  globalForAnalyze._analyzeQueue = analyzeQueue;
}

const globalForAnalyzeGenre = globalThis as unknown as { _analyzeGenreQueue?: AnalyzeGenreQueue };

class AnalyzeGenreQueue {
  private q = new Queue<AnalyzeGenreJobData>(QUEUE_ANALYZE_GENRE, {
    connection: {
      url: process.env.REDIS_URL ?? 'redis://localhost:6379',
      maxRetriesPerRequest: null as unknown as number,
    },
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });

  // deduplication.id — дедуп повторного клика «Определить жанр» до завершения джобы;
  // в отличие от фиксированного jobId, снимается по завершении/провалу (иначе остался бы занят в completed/failed).
  async add(data: AnalyzeGenreJobData): Promise<void> {
    await this.q.add('analyze-genre', data, { deduplication: { id: `analyze-genre:${data.trackId}` } });
  }
}

export const analyzeGenreQueue: AnalyzeGenreQueue =
  globalForAnalyzeGenre._analyzeGenreQueue ?? new AnalyzeGenreQueue();

if (process.env.NODE_ENV !== 'production') {
  globalForAnalyzeGenre._analyzeGenreQueue = analyzeGenreQueue;
}
