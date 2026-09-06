import { Worker, type Job } from 'bullmq';
import {
  getPresaverUserIds,
  getReadyTrackIds,
  bulkLikeTracks,
  getPresaverContacts,
  markPresavesFulfilled,
} from '@vire/db';
import { QUEUE_FULFILL_PRESAVE, emailShell, type FulfillPresaveJobData } from '@vire/core';
import { getTranslator, isLocale, localizedPath, DEFAULT_LOCALE, type Locale } from '@vire/i18n';
import { baseWorkerOptions } from '../queues/worker-options.js';
import { sendMail } from '../lib/mailer.js';
import { buildUnsubscribeUrl } from '../lib/presave-unsubscribe.js';

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

async function buildEmail(
  data: FulfillPresaveJobData,
  recipientName: string | null,
  locale: Locale,
  unsubscribeUrl: string | null,
): Promise<{ subject: string; html: string }> {
  const t = await getTranslator(locale, 'email');
  const releaseUrl = `${APP_URL}${localizedPath(locale, `/artists/${data.artistSlug}/releases/${data.releaseId}`)}`;
  const greeting = recipientName
    ? t('presaveOut.greeting', { name: recipientName })
    : t('presaveOut.greetingAnonymous');

  const subject = t('presaveOut.subject', {
    artistName: data.artistName,
    releaseTitle: data.releaseTitle,
  });

  const footerHtml = unsubscribeUrl
    ? `${t('presaveOut.footer')} <a href="${unsubscribeUrl}" style="color:#666">${t('presaveOut.unsubscribe')}</a>`
    : t('presaveOut.footer');

  const html = emailShell({
    locale,
    heading: t('presaveOut.heading', { releaseTitle: data.releaseTitle }),
    subheading: data.releaseTitle,
    imageUrl: data.coverUrl ?? undefined,
    bodyHtml: t('presaveOut.body', { greeting, type: data.releaseType, releaseTitle: data.releaseTitle, artistName: data.artistName }),
    ctaLabel: t('presaveOut.cta'),
    ctaUrl: releaseUrl,
    footerHtml,
  });

  return { subject, html };
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
  let sent = 0;
  for (const c of contacts) {
    try {
      const locale = c.locale && isLocale(c.locale) ? c.locale : DEFAULT_LOCALE;
      const unsubscribeUrl = c.isGuest ? buildUnsubscribeUrl(APP_URL, c.email, locale) : null;
      const { subject, html } = await buildEmail(data, c.name, locale, unsubscribeUrl);
      await sendMail({ to: c.email, toName: c.name, subject, html });
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
    ...baseWorkerOptions,
    concurrency: 2,
  });
}
