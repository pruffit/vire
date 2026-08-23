import { fromB64, fromUtf8 } from './codec';

// accessToken формата `body.signature` (packages/core/src/platform/identity/device-tokens.ts,
// signAccessToken) — не JWT (нет header-сегмента). body — base64url(JSON({ sub, role, did, ... })).
// Клиент подпись не проверяет (секрет серверный) — только читает свой же claim sub (userId),
// нужный для скоупинга E2EE-личности (apps/web делает то же по session.user.id).
function base64UrlToB64(input: string): string {
  let s = input.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4 !== 0) s += '=';
  return s;
}

export function decodeAccessTokenUserId(accessToken: string): string | null {
  const [body] = accessToken.split('.');
  if (!body) return null;
  try {
    const payload = JSON.parse(fromUtf8(fromB64(base64UrlToB64(body)))) as { sub?: unknown };
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
