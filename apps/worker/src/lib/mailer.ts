// Одиночное транзакционное письмо через Brevo HTTP API (как apps/web/lib/mailer.ts
// и notify-release.worker.ts) — SMTP на проде заблокирован хостингом.
// Используется для сервисных уведомлений артисту (например, падение транскодинга).

import { brevoSender } from './brevo.js';

export async function sendMail(opts: {
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY is not set');

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: 'application/json', 'api-key': apiKey },
    body: JSON.stringify({
      sender: brevoSender(),
      to: [opts.toName ? { email: opts.to, name: opts.toName } : { email: opts.to }],
      subject: opts.subject,
      htmlContent: opts.html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo API ${res.status}: ${text}`);
  }
}
