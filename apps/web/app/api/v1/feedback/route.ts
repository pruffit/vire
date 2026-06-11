import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';

// Ленивая инициализация: на уровне модуля `new Resend()` без ключа бросает на сборке
// (Next вычисляет модуль при сборе данных роута).
let resend: Resend | null = null;
function getResend(): Resend {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

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

  const from = process.env.RESEND_FROM ?? 'onboarding@resend.dev';
  const to = process.env.FEEDBACK_TO ?? from;

  const { error } = await getResend().emails.send({
    from,
    to,
    replyTo: email || undefined,
    subject,
    text,
  });

  // Раньше ответ Resend игнорировался — форма «отправляла» в пустоту.
  if (error) {
    console.error('[feedback] resend error:', error);
    return NextResponse.json({ error: 'Не удалось отправить сообщение' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
