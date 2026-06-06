import 'dotenv/config';
import { createTranscodeWorker } from './workers/transcode.worker.js';
import { createPlayEventsWorker } from './workers/play-events.worker.js';

const transcodeWorker = createTranscodeWorker();
const playEventsWorker = createPlayEventsWorker();

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

console.log('[worker] transcode + play-events workers started');

async function shutdown() {
  await Promise.all([transcodeWorker.close(), playEventsWorker.close()]);
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
