import { Worker, type Job } from 'bullmq';
import { Resend } from 'resend';
import { getFollowerEmails } from '@vire/db';
import { QUEUE_NOTIFY_RELEASE, type NotifyReleaseJobData } from '@vire/core';
import { connection } from '../queues/connection.js';

let resend: Resend | null = null;
function getResend(): Resend {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const FROM = process.env.RESEND_FROM ?? 'Vire <noreply@vire.music>';

const RELEASE_TYPE_RU: Record<string, string> = {
  ALBUM: 'Альбом',
  EP: 'EP',
  SINGLE: 'Сингл',
};

function buildHtml(data: NotifyReleaseJobData, recipientName: string | null): string {
  const typeLabel = RELEASE_TYPE_RU[data.releaseType] ?? data.releaseType;
  const releaseUrl = `${APP_URL}/artists/${data.artistSlug}/releases/${data.releaseId}`;
  const greeting = recipientName ? `Привет, ${recipientName}!` : 'Привет!';

  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:Inter,sans-serif;color:#f5f2eb">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px">
    <p style="font-size:13px;color:#666;margin:0 0 24px">Vire</p>

    <h1 style="font-size:22px;font-weight:600;margin:0 0 6px;line-height:1.3">
      ${data.artistName} выпустил${typeLabel === 'Сингл' ? '' : 'а'} новый ${typeLabel.toLowerCase()}
    </h1>

    ${data.coverUrl ? `<img src="${data.coverUrl}" alt="${data.releaseTitle}" width="200" height="200" style="display:block;border-radius:6px;margin:20px 0;object-fit:cover">` : ''}

    <p style="font-size:20px;font-weight:500;margin:0 0 24px">${data.releaseTitle}</p>

    <p style="margin:0 0 32px;font-size:14px;color:#aaa">${greeting} Вышел новый ${typeLabel.toLowerCase()} от ${data.artistName}.</p>

    <a href="${releaseUrl}" style="display:inline-block;background:#f5f2eb;color:#0d0d0d;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:500">
      Слушать →
    </a>

    <p style="margin:40px 0 0;font-size:12px;color:#444">
      Ты получил это письмо, потому что подписан на ${data.artistName} на Vire.<br>
      <a href="${APP_URL}/profile" style="color:#666">Управлять подписками</a>
    </p>
  </div>
</body>
</html>`;
}

async function handle(job: Job<NotifyReleaseJobData>): Promise<void> {
  const data = job.data;

  const followers = await getFollowerEmails(data.artistProfileId);
  if (followers.length === 0) {
    await job.log('No followers, skipping');
    return;
  }

  await job.log(`Sending to ${followers.length} followers`);

  // Resend batch: up to 100 per call
  const BATCH = 100;
  for (let i = 0; i < followers.length; i += BATCH) {
    const chunk = followers.slice(i, i + BATCH);

    await getResend().batch.send(
      chunk.map((f) => ({
        from: FROM,
        to: f.email,
        subject: `${data.artistName} — ${data.releaseTitle}`,
        html: buildHtml(data, f.name),
      })),
    );

    await job.updateProgress(Math.round(((i + chunk.length) / followers.length) * 100));
  }
}

export function createNotifyReleaseWorker() {
  return new Worker<NotifyReleaseJobData>(QUEUE_NOTIFY_RELEASE, handle, {
    connection,
    concurrency: 2,
  });
}
