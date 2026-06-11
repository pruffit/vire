import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';

const resend = new Resend(process.env.AUTH_RESEND_KEY);

const schema = z.object({
  type: z.enum(['bug', 'idea', 'other']),
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
    other: '💬 Другое',
  };

  const subject = `[Vire] ${typeLabel[type] ?? type} — обратная связь`;
  const text = [
    `Тип: ${typeLabel[type] ?? type}`,
    page ? `Страница: ${page}` : null,
    email ? `Email: ${email}` : null,
    '',
    message,
  ]
    .filter(Boolean)
    .join('\n');

  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? 'onboarding@resend.dev',
    to: 'hello@vire.ru',
    replyTo: email || undefined,
    subject,
    text,
  });

  return NextResponse.json({ ok: true });
}
