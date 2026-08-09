import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateUserNotifyEmail } from '@vire/db';
import { isLocale, localizedPath, DEFAULT_LOCALE } from '@vire/i18n';
import { verifyNotifyUnsub } from '@/lib/notify-unsubscribe';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const schema = z.object({ uid: z.string().min(1).max(128), token: z.string().min(1).max(128) });

// locale приходит из письма (см. apps/worker notify-external.worker.ts) — ссылка сама
// не локализована (api вне [locale]), поэтому редиректим на локаль получателя вручную.
function confirmPage(req: Request, locale: string | null, params: Record<string, string>): Response {
  const loc = locale && isLocale(locale) ? locale : DEFAULT_LOCALE;
  const url = new URL(localizedPath(loc, '/notifications/unsubscribe'), req.url);
  url.search = new URLSearchParams(params).toString();
  return NextResponse.redirect(url, 303);
}

function readTokenParams(req: Request): { uid: string | null; token: string | null; locale: string | null } {
  const { searchParams } = new URL(req.url);
  return { uid: searchParams.get('uid'), token: searchParams.get('token'), locale: searchParams.get('locale') };
}

// GET не мутирует — префетч/сканер почтового клиента иначе отписывает молча (RFC 8058)
export async function GET(req: Request) {
  const rl = await rateLimit(clientKey(req, 'notify-unsub'), 20, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const { locale, ...raw } = readTokenParams(req);
  const parsed = schema.safeParse(raw);
  if (!parsed.success || !verifyNotifyUnsub(parsed.data.uid, parsed.data.token)) {
    return confirmPage(req, locale, { status: 'bad' });
  }
  return confirmPage(req, locale, { uid: parsed.data.uid, token: parsed.data.token });
}

// Принимает и подтверждение с формы страницы, и one-click POST почтовика (List-Unsubscribe-Post)
export async function POST(req: Request) {
  const rl = await rateLimit(clientKey(req, 'notify-unsub'), 20, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const parsed = schema.safeParse(readTokenParams(req));
  if (!parsed.success || !verifyNotifyUnsub(parsed.data.uid, parsed.data.token)) {
    return NextResponse.json({ error: 'Неверная ссылка отписки' }, { status: 400 });
  }

  await updateUserNotifyEmail(parsed.data.uid, false);
  return NextResponse.json({ ok: true });
}
