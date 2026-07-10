import { Worker, type Job } from 'bullmq';
import {
  getPresaverUserIds,
  getReadyTrackIds,
  bulkLikeTracks,
  getPresaverContacts,
  markPresavesFulfilled,
} from '@vire/db';
import { QUEUE_FULFILL_PRESAVE, type FulfillPresaveJobData } from '@vire/core';
import { connection } from '../queues/connection.js';
import { sendMail } from '../lib/mailer.js';
import { buildUnsubscribeUrl } from '../lib/presave-unsubscribe.js';

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

const RELEASE_TYPE_RU: Record<string, string> = {
  ALBUM: 'альбом',
  EP: 'EP',
  SINGLE: 'сингл',
};

function buildHtml(
  data: FulfillPresaveJobData,
  recipientName: string | null,
  unsubscribeUrl: string | null,
): string {
  const typeLabel = RELEASE_TYPE_RU[data.releaseType] ?? data.releaseType.toLowerCase();
  const releaseUrl = `${APP_URL}/artists/${data.artistSlug}/releases/${data.releaseId}`;
  const greeting = recipientName ? `Привет, ${recipientName}!` : 'Привет!';

  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:Inter,sans-serif;color:#f5f2eb">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px">
    <p style="font-size:13px;color:#666;margin:0 0 24px">Vire</p>

    <h1 style="font-size:22px;font-weight:600;margin:0 0 6px;line-height:1.3">
      ${data.releaseTitle} уже вышел
    </h1>

    ${data.coverUrl ? `<img src="${data.coverUrl}" alt="${data.releaseTitle}" width="200" height="200" style="display:block;border-radius:6px;margin:20px 0;object-fit:cover">` : ''}

    <p style="margin:0 0 32px;font-size:14px;color:#aaa">
      ${greeting} ${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} «${data.releaseTitle}» от ${data.artistName}, который ты сохранил заранее, теперь доступен. Мы уже добавили его в твои «Лайки».
    </p>

    <a href="${releaseUrl}" style="display:inline-block;background:#f5f2eb;color:#0d0d0d;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:500">
      Слушать →
    </a>

    <p style="margin:40px 0 0;font-size:12px;color:#444">
      Ты получил это письмо, потому что сделал пресейв этого релиза на Vire.
      ${unsubscribeUrl ? `<a href="${unsubscribeUrl}" style="color:#666">Отписаться от таких писем</a>` : ''}
    </p>
  </div>
</body>
</html>`;
}

async function handle(job: Job<FulfillPresaveJobData>): Promise<void> {
  const data = job.data;

  // 1) Авто-лайк: треки релиза попадают в «Лайки» пресейверов-юзеров.
  const [userIds, trackIds] = await Promise.all([
    getPresaverUserIds(data.releaseId),
    getReadyTrackIds(data.releaseId),
  ]);
  await bulkLikeTracks(userIds, trackIds);
  await job.log(`auto-liked ${trackIds.length} tracks for ${userIds.length} users`);

  // 2) Письмо «вышло» — юзерам с email и гостям. Ошибка одного адресата не валит
  // джобу (иначе ретрай раздаст дубли тем, кому уже ушло).
  const contacts = await getPresaverContacts(data.releaseId);
  const subject = `${data.artistName} — ${data.releaseTitle} уже вышел`;
  let sent = 0;
  for (const c of contacts) {
    try {
      const unsubscribeUrl = c.isGuest ? buildUnsubscribeUrl(APP_URL, c.email) : null;
      await sendMail({ to: c.email, toName: c.name, subject, html: buildHtml(data, c.name, unsubscribeUrl) });
      sent += 1;
    } catch (err) {
      await job.log(`mail failed for ${c.email}: ${(err as Error).message}`);
    }
  }
  await job.log(`sent ${sent}/${contacts.length} presave emails`);

  // 3) Помечаем исполненными — повторный прогон планировщика не задублирует.
  await markPresavesFulfilled(data.releaseId);
}

export function createFulfillPresaveWorker() {
  return new Worker<FulfillPresaveJobData>(QUEUE_FULFILL_PRESAVE, handle, {
    connection,
    concurrency: 2,
  });
}
