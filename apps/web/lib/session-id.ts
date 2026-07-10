const SESSION_KEY = 'vire_sid';

let pending: Promise<string> | null = null;

async function requestSignedSessionId(): Promise<string> {
  const res = await fetch('/api/v1/session', { method: 'POST' });
  if (!res.ok) throw new Error(`session issue failed: ${res.status}`);
  const data = (await res.json()) as { sessionId: string };
  return data.sessionId;
}

/**
 * Общий идентификатор сессии (heartbeat присутствия, play-events) — держится в
 * sessionStorage. Сервер генерит и HMAC-подписывает id (см. lib/session-signing.ts,
 * /api/v1/session) — свой id клиент придумать не может, только запросить у сервера,
 * иначе подпись не мешала бы накрутке. Первый вызов на вкладке делает round-trip;
 * дальше — из кэша.
 */
export async function getSessionId(): Promise<string> {
  const cached = sessionStorage.getItem(SESSION_KEY);
  if (cached) return cached;

  if (!pending) {
    pending = requestSignedSessionId()
      .then((sid) => {
        sessionStorage.setItem(SESSION_KEY, sid);
        return sid;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}
