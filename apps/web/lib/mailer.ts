export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY is not set');

  const fromRaw = process.env.SMTP_FROM ?? 'VireMusic <noreply@viremusic.ru>';
  const match = fromRaw.match(/^(.+?)\s*<(.+?)>$/);
  const sender = match ? { name: match[1].trim(), email: match[2].trim() } : { email: fromRaw };

  const body: Record<string, unknown> = {
    sender,
    to: [{ email: opts.to }],
    subject: opts.subject,
    textContent: opts.text,
  };
  if (opts.replyTo) body.replyTo = { email: opts.replyTo };

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo API ${res.status}: ${text}`);
  }
}
