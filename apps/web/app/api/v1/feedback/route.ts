import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';
import { sendMail } from '@/lib/mailer';

const schema = z.object({
  type: z.enum(['bug', 'idea', 'artist', 'other']),
  message: z.string().min(10).max(2000),
  page: z.string().max(200).optional(),
  email: z.string().email().optional().or(z.literal('')),
});

export async function POST(req: Request) {
  const rl = await rateLimit(clientKey(req, 'feedback'), 5, 3600);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', issues: parsed.error.issues }, { status: 400 });
  }

  const { type, message, page, email } = parsed.data;

  const typeLabel: Record<string, string> = {
    bug: '🐛 Баг',
    idea: '💡 Идея',
    artist: '🎤 Заявка артиста',
    other: '💬 Другое',
  };

  const subject = `[VireMusic] ${typeLabel[type] ?? type}`;
  const text = [
    `Тип: ${typeLabel[type] ?? type}`,
    page ? `Страница: ${page}` : null,
    email ? `Email: ${email}` : null,
    '',
    message,
  ]
    .filter(Boolean)
    .join('\n');

  const to = process.env.FEEDBACK_TO ?? process.env.SMTP_FROM ?? 'noreply@viremusic.ru';

  try {
    await sendMail({ to, subject, text, replyTo: email || undefined });
  } catch (err) {
    console.error('[feedback] smtp error:', err);
    return NextResponse.json({ error: 'Не удалось отправить сообщение' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
