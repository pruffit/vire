import { Worker, type Job } from 'bullmq';
import { generateSharedPlaylists, generatePersonalPlaylistsForAllUsers } from '@vire/db';
import { QUEUE_EDITORIAL, type EditorialJobData } from '@vire/core';
import { connection } from '../queues/connection.js';

// Регенерация подборок по расписанию (планировщики регистрируются в index.ts):
// scope=shared — общие подборки (раз в сутки), scope=personal — личные всем
// юзерам с сигналом (раз в 4 часа).
async function handle(job: Job<EditorialJobData>): Promise<void> {
  if (job.data.scope === 'shared') {
    await generateSharedPlaylists();
  } else {
    await generatePersonalPlaylistsForAllUsers();
  }
}

export function createEditorialWorker() {
  return new Worker<EditorialJobData>(QUEUE_EDITORIAL, handle, {
    connection,
    concurrency: 1,
  });
}
