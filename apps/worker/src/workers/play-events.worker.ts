import { Worker, type Job } from 'bullmq';
import { insertPlayEvent } from '@vire/db';
import { QUEUE_PLAY_EVENTS, type PlayEventJobData } from '@vire/core';
import { baseWorkerOptions } from '../queues/worker-options.js';

async function process(job: Job<PlayEventJobData>): Promise<void> {
  const { trackId, sessionId, userId, source, durationPlayedSec, startedAt } = job.data;

  await insertPlayEvent({
    trackId,
    sessionId,
    userId,
    source,
    durationPlayedSec,
    startedAt: new Date(startedAt),
  });
}

export function createPlayEventsWorker() {
  return new Worker<PlayEventJobData>(QUEUE_PLAY_EVENTS, process, {
    ...baseWorkerOptions,
    concurrency: 10,
  });
}
