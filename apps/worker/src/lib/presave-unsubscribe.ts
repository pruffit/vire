import { hmacSign } from '@vire/core/signing';

const PURPOSE = 'presave-unsub';

// Тот же секрет и та же схема (id.sig → payload `${PURPOSE}:${email}`), что и
// apps/web/lib/presave-unsubscribe.ts — воркер и web оба читают его из общего
// .env (см. docker-compose.prod.yml, env_file: .env на обоих сервисах).
function signingSecret(): string | null {
  return process.env.LINK_SIGNING_SECRET || process.env.AUTH_SECRET || null;
}

/** Ссылка отписки для письма «вышло»; null, если секрет не настроен — тогда
 *  письмо уходит без ссылки, а не с битой/неверифицируемой. */
export function buildUnsubscribeUrl(
  appUrl: string,
  email: string,
  locale?: string,
): string | null {
  const secret = signingSecret();
  if (!secret) return null;
  const sig = hmacSign(secret, `${PURPOSE}:${email}`);
  const url = new URL('/api/v1/presave/unsubscribe', appUrl);
  url.searchParams.set('email', email);
  url.searchParams.set('sig', sig);
  if (locale) url.searchParams.set('locale', locale);
  return url.toString();
}
