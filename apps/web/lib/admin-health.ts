import { Queue } from 'bullmq';
import { pingDb } from '@vire/db';
import { QUEUE_TRANSCODE, QUEUE_PLAY_EVENTS, QUEUE_NOTIFY_RELEASE } from '@vire/core';
import { pingRedis, listListening } from './presence';

export interface FailedJob {
  id: string;
  name: string;
  failedReason: string;
  attemptsMade: number;
  finishedOn: number | null;
}

export interface QueueHealth {
  name: string;
  label: string;
  waiting: number;
  active: number;
  failed: number;
  delayed: number;
  failedJobs: FailedJob[];
}

export const MANAGED_QUEUES = [QUEUE_TRANSCODE, QUEUE_PLAY_EVENTS, QUEUE_NOTIFY_RELEASE] as const;

export interface AdminHealth {
  dbLatencyMs: number | null;
  redisLatencyMs: number | null;
  liveListeners: number;
  queues: QueueHealth[];
}

const QUEUE_LABELS: Record<string, string> = {
  [QUEUE_TRANSCODE]: 'Транскодинг',
  [QUEUE_PLAY_EVENTS]: 'Play-события',
  [QUEUE_NOTIFY_RELEASE]: 'Рассылки релизов',
};

const globalForHealth = globalThis as unknown as { _healthQueues?: Map<string, Queue> };

function getQueue(name: string): Queue {
  if (!globalForHealth._healthQueues) globalForHealth._healthQueues = new Map();
  let q = globalForHealth._healthQueues.get(name);
  if (!q) {
    q = new Queue(name, {
      connection: {
        url: process.env.REDIS_URL ?? 'redis://localhost:6379',
        maxRetriesPerRequest: null as unknown as number,
      },
    });
    globalForHealth._healthQueues.set(name, q);
  }
  return q;
}

async function queueCounts(name: string): Promise<QueueHealth> {
  const label = QUEUE_LABELS[name] ?? name;
  try {
    const q = getQueue(name);
    const c = await q.getJobCounts('waiting', 'active', 'failed', 'delayed');
    const failed = c.failed ?? 0;
    const failedJobs: FailedJob[] = failed > 0
      ? (await q.getFailed(0, 9)).map((j) => ({
          id: String(j.id),
          name: j.name,
          failedReason: j.failedReason ?? 'без причины',
          attemptsMade: j.attemptsMade,
          finishedOn: j.finishedOn ?? null,
        }))
      : [];
    return {
      name,
      label,
      waiting: c.waiting ?? 0,
      active: c.active ?? 0,
      failed,
      delayed: c.delayed ?? 0,
      failedJobs,
    };
  } catch {
    return { name, label, waiting: 0, active: 0, failed: 0, delayed: 0, failedJobs: [] };
  }
}

/** Повторить все упавшие задачи очереди (вернуть в waiting). */
export async function retryFailedJobs(queueName: string): Promise<number> {
  const jobs = await getQueue(queueName).getFailed(0, 99);
  let n = 0;
  for (const job of jobs) {
    try {
      await job.retry();
      n++;
    } catch {
      // задача могла уже уйти — пропускаем
    }
  }
  return n;
}

/** Удалить все упавшие задачи очереди из Redis. */
export async function cleanFailedJobs(queueName: string): Promise<number> {
  const removed = await getQueue(queueName).clean(0, 1000, 'failed');
  return removed.length;
}

/** Состояние систем для админ-обзора. Любой сбой деградирует до null/нулей. */
export async function getAdminHealth(): Promise<AdminHealth> {
  const [dbLatencyMs, redisLatencyMs, live, queues] = await Promise.all([
    pingDb(),
    pingRedis(),
    listListening(100).catch(() => []),
    Promise.all([QUEUE_TRANSCODE, QUEUE_PLAY_EVENTS, QUEUE_NOTIFY_RELEASE].map(queueCounts)),
  ]);

  return {
    dbLatencyMs,
    redisLatencyMs,
    liveListeners: live.reduce((s, l) => s + l.count, 0),
    queues,
  };
}
