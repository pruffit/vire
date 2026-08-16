import { Worker, type Job } from 'bullmq';
import { DrizzleOrphanedStorageRepository } from '@vire/db';
import { QUEUE_STORAGE_CLEANUP, StorageCleanupService } from '@vire/core';
import { connection } from '../queues/connection.js';
import { vaultStorage, streamStorage } from '../lib/s3.js';

export async function handle(job: Job): Promise<void> {
  const service = new StorageCleanupService(new DrizzleOrphanedStorageRepository(), {
    vault: vaultStorage,
    stream: streamStorage,
  });

  const result = await service.run(new Date());
  if (result.processed > 0 || result.failed > 0) {
    await job.log(
      `cleaned ${result.processed - result.failed}/${result.processed} entries, ` +
      `${result.removedKeys} objects, failed ${result.failed}, skipped ${result.skipped}`,
    );
  }
}

export function createStorageCleanupWorker() {
  return new Worker(QUEUE_STORAGE_CLEANUP, handle, { connection, concurrency: 1 });
}
