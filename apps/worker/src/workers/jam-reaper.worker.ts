import { Worker, type Job } from 'bullmq';
import { db, DrizzleJamRepository } from '@vire/db';
import { QUEUE_JAM_REAPER } from '@vire/core';
import { baseWorkerOptions } from '../queues/worker-options.js';
import { reapJamRedisState } from '../lib/jam-cleanup.js';

const STALE_HOURS = 12;

export async function handle(_job: Job): Promise<void> {
  const repo = new DrizzleJamRepository(db);
  const stale = await repo.listStaleLiveSessions(STALE_HOURS);
  for (const session of stale) {
    await repo.endSession(session.id);
    await reapJamRedisState(session.id);
  }
}

export function createJamReaperWorker() {
  return new Worker(QUEUE_JAM_REAPER, handle, { ...baseWorkerOptions, concurrency: 1 });
}
