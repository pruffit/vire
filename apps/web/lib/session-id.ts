const SESSION_KEY = 'vire_sid';

/** Общий идентификатор сессии (heartbeat присутствия, play-events) — держится в sessionStorage. */
export function getSessionId(): string {
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}
