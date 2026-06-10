import { Queue } from 'bullmq';
import { pingDb } from '@vire/db';
import { QUEUE_TRANSCODE, QUEUE_PLAY_EVENTS, QUEUE_NOTIFY_RELEASE } from '@vire/core';
import { pingRedis, listListening } from './presence';

export interface QueueHealth {
  name: string;
  label: string;
  waiting: number;
  active: number;
  failed: number;
  delayed: number;
}

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
    const c = await getQueue(name).getJobCounts('waiting', 'active', 'failed', 'delayed');
    return {
      name,
      label,
      waiting: c.waiting ?? 0,
      active: c.active ?? 0,
      failed: c.failed ?? 0,
      delayed: c.delayed ?? 0,
    };
  } catch {
    return { name, label, waiting: 0, active: 0, failed: 0, delayed: 0 };
  }
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
