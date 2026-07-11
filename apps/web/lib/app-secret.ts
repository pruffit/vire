/** HMAC-секрет: `LINK_SIGNING_SECRET`, иначе `AUTH_SECRET` (уже обязателен для Auth.js — без нового секрета на деплое). Ни один не задан — вызывающий код должен деградировать. */
export function getSigningSecret(): string | null {
  return process.env.LINK_SIGNING_SECRET || process.env.AUTH_SECRET || null;
}
