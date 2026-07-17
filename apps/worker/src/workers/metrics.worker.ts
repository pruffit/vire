import { Worker, type Job } from 'bullmq';
import { snapshotPlatformMetricsDaily } from '@vire/db';
import { QUEUE_METRICS } from '@vire/core';
import { connection } from '../queues/connection.js';
import { yesterdayMsk } from '../lib/msk-date.js';

async function handle(_job: Job): Promise<void> {
  await snapshotPlatformMetricsDaily(yesterdayMsk(new Date()));
}

export function createMetricsWorker() {
  return new Worker(QUEUE_METRICS, handle, { connection, concurrency: 1 });
}
