import webpush from 'web-push';

let configured = false;
function ensure(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY, subj = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subj) return false;
  webpush.setVapidDetails(subj, pub, priv);
  configured = true;
  return true;
}

export interface StoredSub { endpoint: string; p256dh: string; auth: string }

/** Возвращает endpoints, которые мертвы (410/404) — их надо удалить. */
export async function sendPush(subs: StoredSub[], payload: { title: string; body: string; url: string; tag?: string }): Promise<string[]> {
  if (!ensure() || subs.length === 0) return [];
  const dead: string[] = [];
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload));
    } catch (e: unknown) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 410 || code === 404) dead.push(s.endpoint);
    }
  }));
  return dead;
}
