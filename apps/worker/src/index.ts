import 'dotenv/config';
import { createTranscodeWorker } from './workers/transcode.worker.js';
import { createPlayEventsWorker } from './workers/play-events.worker.js';
import { createNotifyReleaseWorker } from './workers/notify-release.worker.js';
import { createAnalyzeWorker } from './workers/analyze.worker.js';
import { alertJobFailure, alertWorkerError, alertCrash } from './lib/alert.js';

const transcodeWorker = createTranscodeWorker();
const playEventsWorker = createPlayEventsWorker();
const notifyReleaseWorker = createNotifyReleaseWorker();
const analyzeWorker = createAnalyzeWorker();

transcodeWorker.on('completed', (job) => {
  console.log(`[transcode] ✓ job=${job.id} track=${job.data.trackId}`);
});

transcodeWorker.on('failed', (job, err) => {
  void alertJobFailure('transcode', job?.id, err, { trackId: job?.data.trackId });
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

console.log('[worker] transcode + analyze + play-events + notify-release workers started');

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
  ]);
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
