import 'dotenv/config';
import { createTranscodeWorker } from './workers/transcode.worker.js';

const worker = createTranscodeWorker();

worker.on('completed', (job) => {
  console.log(`[transcode] ✓ job=${job.id} track=${job.data.trackId}`);
});

worker.on('failed', (job, err) => {
  console.error(`[transcode] ✗ job=${job?.id} track=${job?.data.trackId}`, err.message);
});

worker.on('error', (err) => {
  console.error('[transcode] worker error', err);
});

console.log('[worker] transcode worker started');

async function shutdown() {
  await worker.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
