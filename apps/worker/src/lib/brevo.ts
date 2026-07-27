function brevoSender(): { name?: string; email: string } {
  const raw = process.env.SMTP_FROM ?? 'VireMusic <noreply@viremusic.ru>';
  const m = raw.match(/^(.+?)\s*<(.+?)>$/);
  return m ? { name: m[1].trim(), email: m[2].trim() } : { email: raw };
}

export async function sendBrevoEmail(
  to: { email: string; name?: string | null },
  subject: string,
  html: string,
  headers?: Record<string, string>,
): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return; // email-канал деградирует молча
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: 'application/json', 'api-key': apiKey },
    body: JSON.stringify({
      sender: brevoSender(),
      subject,
      htmlContent: html,
      to: [to.name ? { email: to.email, name: to.name } : { email: to.email }],
      ...(headers && Object.keys(headers).length ? { headers } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Brevo API ${res.status}: ${await res.text()}`);
}
