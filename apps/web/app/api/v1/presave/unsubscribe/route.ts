import { z } from 'zod';
import { deletePendingGuestPresavesByEmail } from '@vire/db';
import { verifyUnsubscribeToken } from '@/lib/presave-unsubscribe';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';

const schema = z.object({ email: z.string().email().max(254), sig: z.string().min(1).max(128) });

// Презентацию не рисуем здесь (голый HTML не проходит дизайн-гейт и не темизуется) —
// редиректим на страницу /presave/unsubscribed, которая рендерится в оболочке платформы.
function done(req: Request, status: 'ok' | 'bad'): Response {
  return Response.redirect(new URL(`/presave/unsubscribed?status=${status}`, req.url), 303);
}

/**
 * Ссылка «Отписаться» из письма о выходе пресейва: без аккаунта, без новой
 * таблицы токенов — email подписан HMAC'ом (см. lib/presave-unsubscribe.ts).
 * Удаляет неисполненные гостевые пресейвы этого email по всем релизам.
 */
export async function GET(req: Request) {
  const rl = await rateLimit(clientKey(req, 'presave-unsub'), 20, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const url = new URL(req.url);
  const parsed = schema.safeParse({
    email: url.searchParams.get('email'),
    sig: url.searchParams.get('sig'),
  });
  if (!parsed.success) return done(req, 'bad');

  const email = parsed.data.email.trim().toLowerCase();
  if (!verifyUnsubscribeToken(email, parsed.data.sig)) return done(req, 'bad');

  await deletePendingGuestPresavesByEmail(email);
  return done(req, 'ok');
}
