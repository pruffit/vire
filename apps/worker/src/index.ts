import 'dotenv/config';
import { initSentry, flushSentry } from './lib/sentry.js';

// Инициализируем Sentry до создания воркеров, чтобы ловить исключения с первого джоба.
initSentry();

import { Queue } from 'bullmq';
import { QUEUE_EDITORIAL, QUEUE_SCHEDULED_PUBLISH } from '@vire/core';
import { createTranscodeWorker, handleTerminalTranscodeFailure } from './workers/transcode.worker.js';
import { createPlayEventsWorker } from './workers/play-events.worker.js';
import { createNotifyReleaseWorker } from './workers/notify-release.worker.js';
import { createAnalyzeWorker } from './workers/analyze.worker.js';
import { createEditorialWorker } from './workers/editorial.worker.js';
import { createScheduledPublishWorker } from './workers/scheduled-publish.worker.js';
import { createFulfillPresaveWorker } from './workers/fulfill-presave.worker.js';
import { connection } from './queues/connection.js';
import { alertJobFailure, alertWorkerError, alertCrash } from './lib/alert.js';

const transcodeWorker = createTranscodeWorker();
const playEventsWorker = createPlayEventsWorker();
const notifyReleaseWorker = createNotifyReleaseWorker();
const analyzeWorker = createAnalyzeWorker();
const editorialWorker = createEditorialWorker();
const scheduledPublishWorker = createScheduledPublishWorker();
const fulfillPresaveWorker = createFulfillPresaveWorker();

// Планировщики регенерации подборок (cron в МСК): общие — ежедневно в 00:00,
// личные — каждые 4 часа. upsertJobScheduler идемпотентен: повторный запуск
// воркера не плодит дубли, а обновляет расписание.
const editorialQueue = new Queue(QUEUE_EDITORIAL, { connection });
editorialQueue
  .upsertJobScheduler('shared-daily', { pattern: '0 0 * * *', tz: 'Europe/Moscow' }, { name: 'shared', data: { scope: 'shared' } })
  .catch((err) => void alertWorkerError('editorial', err as Error));
editorialQueue
  .upsertJobScheduler('personal-4h', { pattern: '0 */4 * * *', tz: 'Europe/Moscow' }, { name: 'personal', data: { scope: 'personal' } })
  .catch((err) => void alertWorkerError('editorial', err as Error));

// Планировщик авто-выхода SCHEDULED-релизов: раз в минуту проверяем наступившую
// дату выхода, публикуем, шлём уведомления подписчикам и исполняем пресейвы.
const scheduledPublishQueue = new Queue(QUEUE_SCHEDULED_PUBLISH, { connection });
scheduledPublishQueue
  .upsertJobScheduler('due-every-min', { pattern: '* * * * *' }, { name: 'due', data: {} })
  .catch((err) => void alertWorkerError('scheduled-publish', err as Error));

editorialWorker.on('completed', (job) => {
  console.log(`[editorial] ✓ job=${job.id} scope=${job.data.scope}`);
});
editorialWorker.on('failed', (job, err) => {
  void alertJobFailure('editorial', job?.id, err, { scope: job?.data.scope });
});
editorialWorker.on('error', (err) => {
  void alertWorkerError('editorial', err);
});

transcodeWorker.on('completed', (job) => {
  console.log(`[transcode] ✓ job=${job.id} track=${job.data.trackId}`);
});

transcodeWorker.on('failed', (job, err) => {
  void alertJobFailure('transcode', job?.id, err, { trackId: job?.data.trackId });
  // На окончательном падении (исчерпаны попытки) — пометить трек FAILED и
  // уведомить артиста письмом. Функция сама проверяет, что это финал.
  void handleTerminalTranscodeFailure(job);
});

transcodeWorker.on('error', (err) => {
  void alertWorkerError('transcode', err);
});

playEventsWorker.on('failed', (job, err) => {
  void alertJobFailure('play-events', job?.id, err);
});

playEventsWorker.on('error', (err) => {
  void alertWorkerError('play-events', err);
});

notifyReleaseWorker.on('completed', (job) => {
  console.log(`[notify-release] ✓ job=${job.id} release=${job.data.releaseId}`);
});

notifyReleaseWorker.on('failed', (job, err) => {
  void alertJobFailure('notify-release', job?.id, err, { releaseId: job?.data.releaseId });
});

notifyReleaseWorker.on('error', (err) => {
  void alertWorkerError('notify-release', err);
});

scheduledPublishWorker.on('failed', (job, err) => {
  void alertJobFailure('scheduled-publish', job?.id, err);
});
scheduledPublishWorker.on('error', (err) => {
  void alertWorkerError('scheduled-publish', err);
});

fulfillPresaveWorker.on('completed', (job) => {
  console.log(`[fulfill-presave] ✓ job=${job.id} release=${job.data.releaseId}`);
});
fulfillPresaveWorker.on('failed', (job, err) => {
  void alertJobFailure('fulfill-presave', job?.id, err, { releaseId: job?.data.releaseId });
});
fulfillPresaveWorker.on('error', (err) => {
  void alertWorkerError('fulfill-presave', err);
});

console.log('[worker] transcode + analyze + play-events + notify-release + editorial + scheduled-publish + fulfill-presave workers started');

analyzeWorker.on('completed', (job) => {
  console.log(`[analyze] ✓ job=${job.id} track=${job.data.trackId}`);
});
analyzeWorker.on('failed', (job, err) => {
  void alertJobFailure('analyze', job?.id, err, { trackId: job?.data.trackId });
});
analyzeWorker.on('error', (err) => {
  void alertWorkerError('analyze', err);
});

// Падение процесса целиком: алертим (дождавшись доставки) и выходим с кодом 1,
// сохраняя crash-семантику Node. Иначе воркер умирал бы молча, а загрузки
// застревали бы в PROCESSING без единого уведомления.
process.on('uncaughtException', (err) => {
  // alertCrash синхронно вызывает captureWorkerException до await — флашим Sentry
  // параллельно с доставкой Telegram, затем выходим.
  void Promise.allSettled([alertCrash('uncaughtException', err), flushSentry()]).finally(() => process.exit(1));
});
process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  void Promise.allSettled([alertCrash('unhandledRejection', err), flushSentry()]).finally(() => process.exit(1));
});

async function shutdown() {
  await Promise.all([
    transcodeWorker.close(),
    playEventsWorker.close(),
    notifyReleaseWorker.close(),
    analyzeWorker.close(),
    editorialWorker.close(),
    editorialQueue.close(),
    scheduledPublishWorker.close(),
    fulfillPresaveWorker.close(),
    scheduledPublishQueue.close(),
  ]);
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
