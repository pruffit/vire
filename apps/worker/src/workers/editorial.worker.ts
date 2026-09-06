import { Worker, type Job } from 'bullmq';
import { generateSharedPlaylists, generatePersonalPlaylistsForAllUsers } from '@vire/db';
import { QUEUE_EDITORIAL, type EditorialJobData } from '@vire/core';
import { baseWorkerOptions } from '../queues/worker-options.js';

// scope=shared — общие подборки (раз в сутки), scope=personal — личные всем юзерам (раз в 4ч)
async function handle(job: Job<EditorialJobData>): Promise<void> {
  if (job.data.scope === 'shared') {
    await generateSharedPlaylists();
  } else {
    await generatePersonalPlaylistsForAllUsers();
  }
}

export function createEditorialWorker() {
  return new Worker<EditorialJobData>(QUEUE_EDITORIAL, handle, {
    ...baseWorkerOptions,
    concurrency: 1,
  });
}
