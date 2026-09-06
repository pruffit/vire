import 'dotenv/config';
import { Queue } from 'bullmq';
import { QUEUE_EDITORIAL, QUEUE_SCHEDULED_PUBLISH, QUEUE_METRICS, QUEUE_JAM_REAPER, QUEUE_STORAGE_CLEANUP, parseEnv, normalizeMediaJob } from '@vire/core';
import { createTranscodeWorker, handleTerminalTranscodeFailure } from './workers/transcode.worker.js';
import { createPlayEventsWorker } from './workers/play-events.worker.js';
import { createNotifyReleaseWorker } from './workers/notify-release.worker.js';
import { createAnalyzeWorker } from './workers/analyze.worker.js';
import { createAnalyzeGenreWorker } from './workers/analyze-genre.worker.js';
import { createEditorialWorker } from './workers/editorial.worker.js';
import { createScheduledPublishWorker } from './workers/scheduled-publish.worker.js';
import { createFulfillPresaveWorker } from './workers/fulfill-presave.worker.js';
import { createMetricsWorker } from './workers/metrics.worker.js';
import { createNotifyExternalWorker } from './workers/notify-external.worker.js';
import { createJamReaperWorker } from './workers/jam-reaper.worker.js';
import { createStorageCleanupWorker } from './workers/storage-cleanup.worker.js';
import { connection, closeConnection } from './queues/connection.js';
import { alertJobFailure, alertWorkerError, alertCrash } from './lib/alert.js';
import { jobDurationMs } from './lib/timing.js';

/** Один формат строки успеха на все очереди: без длительности нельзя ответить,
 *  почему медленно — алерты ловят только факт падения. */
function logDone(queue: string, job: { id?: string; processedOn?: number | null; finishedOn?: number | null }, extra = '') {
  const ms = jobDurationMs(job);
  const took = ms === null ? '' : ` took=${ms}ms`;
  console.log(`[${queue}] ✓ job=${job.id ?? '?'}${extra}${took}`);
}

const envResult = parseEnv(process.env, 'worker');
if (!envResult.ok) {
  const missing = envResult.error.issues.map((i) => i.variable).join(', ');
  throw new Error(`Некорректная конфигурация окружения (worker): не заданы ${missing}`);
}
if (envResult.value.degraded.length > 0) {
  const features = envResult.value.degraded.map((d) => `${d.feature} (нет ${d.missing.join(', ')})`).join('; ');
  console.warn(`[env] фичи выключены из-за отсутствующих переменных: ${features}`);
}

const transcodeWorker = createTranscodeWorker();
const playEventsWorker = createPlayEventsWorker();
const notifyReleaseWorker = createNotifyReleaseWorker();
const analyzeWorker = createAnalyzeWorker();
const analyzeGenreWorker = createAnalyzeGenreWorker();
const editorialWorker = createEditorialWorker();
const scheduledPublishWorker = createScheduledPublishWorker();
const fulfillPresaveWorker = createFulfillPresaveWorker();
const metricsWorker = createMetricsWorker();
const notifyExternalWorker = createNotifyExternalWorker();
const jamReaperWorker = createJamReaperWorker();
const storageCleanupWorker = createStorageCleanupWorker();

// upsertJobScheduler идемпотентен: повторный запуск воркера не плодит дубли, обновляет расписание.
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

// Снапшот метрик за вчера, чуть после полуночи МСК — даёт время editorial-крону (00:00) отойти.
const metricsQueue = new Queue(QUEUE_METRICS, { connection });
metricsQueue
  .upsertJobScheduler('metrics-daily', { pattern: '10 0 * * *', tz: 'Europe/Moscow' }, { name: 'snapshot', data: {} })
  .catch((err) => void alertWorkerError('metrics-daily', err as Error));

// Авто-закрытие джемов без активности 12ч+, раз в 15 минут.
const jamReaperQueue = new Queue(QUEUE_JAM_REAPER, { connection });
jamReaperQueue
  .upsertJobScheduler('jam-reaper-15m', { pattern: '*/15 * * * *', tz: 'Europe/Moscow' }, { name: 'reap', data: {} })
  .catch((err) => void alertWorkerError('jam-reaper', err as Error));

// Уборка файлов удалённых треков/релизов — раз в час; сами записи ждут grace-периода (сутки).
const storageCleanupQueue = new Queue(QUEUE_STORAGE_CLEANUP, { connection });
storageCleanupQueue
  .upsertJobScheduler('storage-cleanup-hourly', { pattern: '30 * * * *', tz: 'Europe/Moscow' }, { name: 'sweep', data: {} })
  .catch((err) => void alertWorkerError('storage-cleanup', err as Error));

editorialWorker.on('completed', (job) => {
  logDone('editorial', job, ` scope=${job.data.scope}`);
});
editorialWorker.on('failed', (job, err) => {
  void alertJobFailure('editorial', job?.id, err, { scope: job?.data.scope });
});
editorialWorker.on('error', (err) => {
  void alertWorkerError('editorial', err);
});

transcodeWorker.on('completed', (job) => {
  logDone('transcode', job, ` asset=${normalizeMediaJob(job.data)?.assetId ?? '?'}`);
});

transcodeWorker.on('failed', (job, err) => {
  const assetId = job ? normalizeMediaJob(job.data)?.assetId : undefined;
  void alertJobFailure('transcode', job?.id, err, { trackId: assetId });
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
  logDone('notify-release', job, ` release=${job.data.releaseId}`);
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
  logDone('fulfill-presave', job, ` release=${job.data.releaseId}`);
});
fulfillPresaveWorker.on('failed', (job, err) => {
  void alertJobFailure('fulfill-presave', job?.id, err, { releaseId: job?.data.releaseId });
});
fulfillPresaveWorker.on('error', (err) => {
  void alertWorkerError('fulfill-presave', err);
});

metricsWorker.on('completed', (job) => {
  logDone('metrics-daily', job);
});
metricsWorker.on('failed', (job, err) => {
  void alertJobFailure('metrics-daily', job?.id, err);
});
metricsWorker.on('error', (err) => {
  void alertWorkerError('metrics-daily', err);
});

console.log('[worker] transcode + analyze + analyze-genre + play-events + notify-release + editorial + scheduled-publish + fulfill-presave + metrics-daily + notify-external + jam-reaper workers started');

analyzeWorker.on('completed', (job) => {
  logDone('analyze', job, ` track=${job.data.trackId}`);
});
analyzeWorker.on('failed', (job, err) => {
  void alertJobFailure('analyze', job?.id, err, { trackId: job?.data.trackId });
});
analyzeWorker.on('error', (err) => {
  void alertWorkerError('analyze', err);
});

analyzeGenreWorker.on('completed', (job) => {
  logDone('analyze-genre', job, ` track=${job.data.trackId}`);
});
analyzeGenreWorker.on('failed', (job, err) => {
  void alertJobFailure('analyze-genre', job?.id, err, { trackId: job?.data.trackId });
});
analyzeGenreWorker.on('error', (err) => {
  void alertWorkerError('analyze-genre', err);
});

notifyExternalWorker.on('completed', (job) => {
  logDone('notify-external', job, ` kind=${job.data.kind}`);
});
notifyExternalWorker.on('failed', (job, err) => {
  void alertJobFailure('notify-external', job?.id, err, { kind: job?.data.kind });
});
notifyExternalWorker.on('error', (err) => {
  void alertWorkerError('notify-external', err);
});

jamReaperWorker.on('completed', (job) => {
  logDone('jam-reaper', job);
});
jamReaperWorker.on('failed', (job, err) => {
  void alertJobFailure('jam-reaper', job?.id, err);
});
jamReaperWorker.on('error', (err) => {
  void alertWorkerError('jam-reaper', err);
});

storageCleanupWorker.on('failed', (job, err) => {
  void alertJobFailure('storage-cleanup', job?.id, err);
});
storageCleanupWorker.on('error', (err) => {
  void alertWorkerError('storage-cleanup', err);
});

// Алертим (дождавшись доставки) и выходим с кодом 1 — иначе воркер умирал бы молча,
// а загрузки застревали бы в PROCESSING без уведомления.
process.on('uncaughtException', (err) => {
  void alertCrash('uncaughtException', err).finally(() => process.exit(1));
});
process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  void alertCrash('unhandledRejection', err).finally(() => process.exit(1));
});

async function shutdown() {
  await Promise.all([
    transcodeWorker.close(),
    playEventsWorker.close(),
    notifyReleaseWorker.close(),
    analyzeWorker.close(),
    analyzeGenreWorker.close(),
    editorialWorker.close(),
    editorialQueue.close(),
    scheduledPublishWorker.close(),
    fulfillPresaveWorker.close(),
    scheduledPublishQueue.close(),
    metricsWorker.close(),
    metricsQueue.close(),
    notifyExternalWorker.close(),
    jamReaperWorker.close(),
    jamReaperQueue.close(),
    storageCleanupWorker.close(),
    storageCleanupQueue.close(),
  ]);
  await closeConnection();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
