export const TYPING_THROTTLE_MS = 2500;
export const TYPING_INDICATOR_TIMEOUT_MS = 4000;

/** Троттлинг chat:typing-пингов — не чаще одного раза в TYPING_THROTTLE_MS (1:1 с web's message-composer.tsx). */
export function shouldSendTypingPing(lastSentAt: number, now: number): boolean {
  return now - lastSentAt >= TYPING_THROTTLE_MS;
}

/** Своё последнее сообщение прочитано, если chat:read собеседника пришёл не раньше его отправки. */
export function isReadByPeer(lastOwnMessageCreatedAt: string | null, peerReadAt: string | null): boolean {
  if (!lastOwnMessageCreatedAt || !peerReadAt) return false;
  return new Date(peerReadAt).getTime() >= new Date(lastOwnMessageCreatedAt).getTime();
}
