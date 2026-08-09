import { z } from 'zod';
import { db, DrizzlePresaveRepository } from '@vire/db';
import { PresaveService } from '@vire/core';
import { isLocale, localizedPath, DEFAULT_LOCALE } from '@vire/i18n';
import { verifyUnsubscribeToken } from '@/lib/presave-unsubscribe';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';

const schema = z.object({ email: z.string().email().max(254), sig: z.string().min(1).max(128) });

// locale — необязательный параметр, готовим редирект под будущего локале-осведомлённого
// отправителя писем; пока ссылка без locale ведёт на дефолтную (ru) страницу как раньше.
function done(req: Request, locale: string | null, status: 'ok' | 'bad'): Response {
  const loc = locale && isLocale(locale) ? locale : DEFAULT_LOCALE;
  const url = new URL(localizedPath(loc, '/presave/unsubscribed'), req.url);
  url.search = new URLSearchParams({ status }).toString();
  return Response.redirect(url, 303);
}

// отписка из письма без аккаунта и таблицы токенов — email подписан HMAC (lib/presave-unsubscribe.ts)
export async function GET(req: Request) {
  const rl = await rateLimit(clientKey(req, 'presave-unsub'), 20, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const url = new URL(req.url);
  const locale = url.searchParams.get('locale');
  const parsed = schema.safeParse({
    email: url.searchParams.get('email'),
    sig: url.searchParams.get('sig'),
  });
  if (!parsed.success) return done(req, locale, 'bad');

  const email = parsed.data.email.trim().toLowerCase();
  if (!verifyUnsubscribeToken(email, parsed.data.sig)) return done(req, locale, 'bad');

  const service = new PresaveService(new DrizzlePresaveRepository(db), { now: () => Date.now() });
  await service.unsubscribeGuest(email);
  return done(req, locale, 'ok');
}
