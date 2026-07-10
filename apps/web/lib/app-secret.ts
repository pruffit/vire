/**
 * Секрет для HMAC-подписи (sessionId присутствия, ссылка отписки от пресейва).
 * Отдельный `LINK_SIGNING_SECRET`, если задан; иначе — `AUTH_SECRET` (уже
 * обязателен для Auth.js, так что защита работает "из коробки" без нового
 * секрета на деплое). Ни один не задан — вызывающий код должен деградировать.
 */
export function getSigningSecret(): string | null {
  return process.env.LINK_SIGNING_SECRET || process.env.AUTH_SECRET || null;
}
