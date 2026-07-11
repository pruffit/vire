import { z } from 'zod';
import { deletePendingGuestPresavesByEmail } from '@vire/db';
import { verifyUnsubscribeToken } from '@/lib/presave-unsubscribe';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';

const schema = z.object({ email: z.string().email().max(254), sig: z.string().min(1).max(128) });

function done(req: Request, status: 'ok' | 'bad'): Response {
  return Response.redirect(new URL(`/presave/unsubscribed?status=${status}`, req.url), 303);
}

// отписка из письма без аккаунта и таблицы токенов — email подписан HMAC (lib/presave-unsubscribe.ts)
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
