import { Worker, type Job } from 'bullmq';
import { getFollowerEmails } from '@vire/db';
import { QUEUE_NOTIFY_RELEASE, emailShell, type NotifyReleaseJobData } from '@vire/core';
import { getTranslator, isLocale, localizedPath, DEFAULT_LOCALE, type Locale } from '@vire/i18n';
import { connection } from '../queues/connection.js';
import { brevoSender } from '../lib/brevo.js';

// Brevo HTTP API — SMTP на проде заблокирован хостингом. messageVersions — батч:
// каждый адресат получает отдельное письмо на своей локали.
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

interface BrevoMessageVersion {
  to: Array<{ email: string; name?: string }>;
  subject: string;
  htmlContent: string;
}

async function sendBrevoBatch(
  subjectFallback: string,
  htmlFallback: string,
  messageVersions: BrevoMessageVersion[],
): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY is not set');
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: 'application/json', 'api-key': apiKey },
    body: JSON.stringify({
      sender: brevoSender(),
      subject: subjectFallback,
      htmlContent: htmlFallback,
      messageVersions,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo API ${res.status}: ${text}`);
  }
}

async function buildEmail(
  data: NotifyReleaseJobData,
  recipientName: string | null,
  locale: Locale,
): Promise<{ subject: string; html: string }> {
  const t = await getTranslator(locale, 'email');
  const releaseUrl = `${APP_URL}${localizedPath(locale, `/artists/${data.artistSlug}/releases/${data.releaseId}`)}`;
  const manageUrl = `${APP_URL}${localizedPath(locale, '/profile')}`;

  const subject = t('release.subject', { artistName: data.artistName, releaseTitle: data.releaseTitle });
  const heading = t('release.heading', { artistName: data.artistName, type: data.releaseType });
  const greeting = recipientName
    ? t('release.greeting', { name: recipientName })
    : t('release.greetingAnonymous');
  const body = t('release.body', { greeting, artistName: data.artistName, type: data.releaseType });
  const cta = t('release.cta');
  const footer = t('release.footer', { artistName: data.artistName });
  const manageLabel = t('release.manageSubscriptions');

  const html = emailShell({
    locale,
    heading,
    subheading: data.releaseTitle,
    imageUrl: data.coverUrl ?? undefined,
    bodyHtml: body,
    ctaLabel: cta,
    ctaUrl: releaseUrl,
    footerHtml: `${footer}<br><a href="${manageUrl}" style="color:#666">${manageLabel}</a>`,
  });

  return { subject, html };
}

async function handle(job: Job<NotifyReleaseJobData>): Promise<void> {
  const data = job.data;

  const followers = await getFollowerEmails(data.artistProfileId);
  if (followers.length === 0) {
    await job.log('No followers, skipping');
    return;
  }

  await job.log(`Sending to ${followers.length} followers`);

  const fallback = await buildEmail(data, null, DEFAULT_LOCALE);
  // Brevo messageVersions: до 1000 на запрос — берём с запасом по 500
  const BATCH = 500;
  for (let i = 0; i < followers.length; i += BATCH) {
    const chunk = followers.slice(i, i + BATCH);

    const versions = await Promise.all(
      chunk.map(async (f): Promise<BrevoMessageVersion> => {
        const locale = isLocale(f.locale ?? '') ? (f.locale as Locale) : DEFAULT_LOCALE;
        const { subject, html } = await buildEmail(data, f.name, locale);
        return {
          to: [f.name ? { email: f.email, name: f.name } : { email: f.email }],
          subject,
          htmlContent: html,
        };
      }),
    );

    await sendBrevoBatch(fallback.subject, fallback.html, versions);

    await job.updateProgress(Math.round(((i + chunk.length) / followers.length) * 100));
  }
}

export function createNotifyReleaseWorker() {
  return new Worker<NotifyReleaseJobData>(QUEUE_NOTIFY_RELEASE, handle, {
    connection,
    concurrency: 2,
  });
}
