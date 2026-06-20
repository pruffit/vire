import { Worker, Queue, type Job } from 'bullmq';
import { findDueScheduledReleases, publishScheduledRelease } from '@vire/db';
import {
  QUEUE_SCHEDULED_PUBLISH,
  QUEUE_NOTIFY_RELEASE,
  QUEUE_FULFILL_PRESAVE,
  type NotifyReleaseJobData,
  type FulfillPresaveJobData,
} from '@vire/core';
import { connection } from '../queues/connection.js';

// Планировщик прогоняется по cron (см. index.ts). Находит SCHEDULED-релизы с
// наступившей датой, атомарно публикует их и ставит уведомление подписчикам
// (notify-release) + исполнение пресейвов (fulfill-presave). До этого
// запланированные релизы становились «в эфире» по дате неявно (через предикаты
// запросов), но писем подписчикам при авто-выходе не уходило вовсе — это чинит.
const notifyQueue = new Queue<NotifyReleaseJobData>(QUEUE_NOTIFY_RELEASE, { connection });
const presaveQueue = new Queue<FulfillPresaveJobData>(QUEUE_FULFILL_PRESAVE, { connection });

async function handle(job: Job): Promise<void> {
  const due = await findDueScheduledReleases();
  for (const r of due) {
    // publishScheduledRelease матчит строку только пока она SCHEDULED — гонка
    // двух прогонов даст один true, дубля уведомлений не будет.
    const published = await publishScheduledRelease(r.id);
    if (!published) continue;
    await job.log(`published ${r.id} (${r.title})`);

    await notifyQueue.add('notify-release', {
      releaseId: r.id,
      releaseTitle: r.title,
      releaseType: r.type,
      coverUrl: r.coverUrl,
      artistProfileId: r.artistProfileId,
      artistName: r.artistName,
      artistSlug: r.artistSlug,
    });
    await presaveQueue.add('fulfill-presave', {
      releaseId: r.id,
      releaseTitle: r.title,
      releaseType: r.type,
      coverUrl: r.coverUrl,
      artistName: r.artistName,
      artistSlug: r.artistSlug,
    });
  }
}

export function createScheduledPublishWorker() {
  return new Worker(QUEUE_SCHEDULED_PUBLISH, handle, { connection, concurrency: 1 });
}
