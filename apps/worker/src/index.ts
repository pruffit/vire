import 'dotenv/config';
import { createTranscodeWorker } from './workers/transcode.worker.js';
import { createPlayEventsWorker } from './workers/play-events.worker.js';
import { createNotifyReleaseWorker } from './workers/notify-release.worker.js';

const transcodeWorker = createTranscodeWorker();
const playEventsWorker = createPlayEventsWorker();
const notifyReleaseWorker = createNotifyReleaseWorker();

transcodeWorker.on('completed', (job) => {
  console.log(`[transcode] ✓ job=${job.id} track=${job.data.trackId}`);
});

transcodeWorker.on('failed', (job, err) => {
  console.error(`[transcode] ✗ job=${job?.id} track=${job?.data.trackId}`, err.message);
});

transcodeWorker.on('error', (err) => {
  console.error('[transcode] worker error', err);
});

playEventsWorker.on('failed', (job, err) => {
  console.error(`[play-events] ✗ job=${job?.id}`, err.message);
});

playEventsWorker.on('error', (err) => {
  console.error('[play-events] worker error', err);
});

notifyReleaseWorker.on('completed', (job) => {
  console.log(`[notify-release] ✓ job=${job.id} release=${job.data.releaseId}`);
});

notifyReleaseWorker.on('failed', (job, err) => {
  console.error(`[notify-release] ✗ job=${job?.id}`, err.message);
});

notifyReleaseWorker.on('error', (err) => {
  console.error('[notify-release] worker error', err);
});

console.log('[worker] transcode + play-events + notify-release workers started');

async function shutdown() {
  await Promise.all([transcodeWorker.close(), playEventsWorker.close(), notifyReleaseWorker.close()]);
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
