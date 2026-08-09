import { Worker, type Job } from 'bullmq';
import { getFollowerEmails } from '@vire/db';
import { QUEUE_NOTIFY_RELEASE, type NotifyReleaseJobData } from '@vire/core';
import { getTranslator, isLocale, localizedPath, DEFAULT_LOCALE, type Locale } from '@vire/i18n';
import { connection } from '../queues/connection.js';

// Brevo HTTP API — SMTP на проде заблокирован хостингом. messageVersions — батч:
// каждый адресат получает отдельное письмо на своей локали.
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

function brevoSender(): { name?: string; email: string } {
  const raw = process.env.SMTP_FROM ?? 'VireMusic <noreply@viremusic.ru>';
  const m = raw.match(/^(.+?)\s*<(.+?)>$/);
  return m ? { name: m[1].trim(), email: m[2].trim() } : { email: raw };
}

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

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:Inter,sans-serif;color:#f5f2eb">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px">
    <p style="font-size:13px;color:#666;margin:0 0 24px">VireMusic</p>

    <h1 style="font-size:22px;font-weight:600;margin:0 0 6px;line-height:1.3">
      ${heading}
    </h1>

    ${data.coverUrl ? `<img src="${data.coverUrl}" alt="${data.releaseTitle}" width="200" height="200" style="display:block;border-radius:6px;margin:20px 0;object-fit:cover">` : ''}

    <p style="font-size:20px;font-weight:500;margin:0 0 24px">${data.releaseTitle}</p>

    <p style="margin:0 0 32px;font-size:14px;color:#aaa">${body}</p>

    <a href="${releaseUrl}" style="display:inline-block;background:#f5f2eb;color:#0d0d0d;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:500">
      ${cta} →
    </a>

    <p style="margin:40px 0 0;font-size:12px;color:#444">
      ${footer}<br>
      <a href="${manageUrl}" style="color:#666">${manageLabel}</a>
    </p>
  </div>
</body>
</html>`;

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
