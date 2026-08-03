function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();

export type SubscribeResult = { ok: true } | { ok: false; reason: 'permission' | 'sw' | 'push-service' | 'server' };

export async function getPushState(): Promise<'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'> {
  if (
    typeof window === 'undefined' ||
    typeof Notification === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !VAPID
  ) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return sub ? 'subscribed' : 'unsubscribed';
}

export async function subscribeToPush(): Promise<SubscribeResult> {
  if (!VAPID || typeof Notification === 'undefined' || !('serviceWorker' in navigator)) {
    return { ok: false, reason: 'sw' };
  }

  let perm: NotificationPermission;
  try {
    perm = await Notification.requestPermission();
  } catch (err) {
    console.error('push: requestPermission failed', err);
    return { ok: false, reason: 'permission' };
  }
  if (perm !== 'granted') return { ok: false, reason: 'permission' };

  let reg: ServiceWorkerRegistration;
  try {
    // Регистрация теперь общая (ServiceWorkerRegistrar в layout); fallback на register(),
    // если виджет ещё не успел зарегистрировать SW.
    const existing = await navigator.serviceWorker.getRegistration();
    reg = existing ?? (await navigator.serviceWorker.register('/sw.js'));
  } catch (err) {
    console.error('push: service worker register failed', err);
    return { ok: false, reason: 'sw' };
  }

  let sub: PushSubscription;
  try {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) as BufferSource });
  } catch (err) {
    console.error('push: pushManager.subscribe failed', err);
    return { ok: false, reason: 'push-service' };
  }

  const json = sub.toJSON();
  try {
    const res = await fetch('/api/v1/push/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true };
  } catch (err) {
    console.error('push: server subscribe failed', err);
    try { await sub.unsubscribe(); } catch { /* откат best-effort */ }
    return { ok: false, reason: 'server' };
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (!sub) return;
    try {
      const res = await fetch('/api/v1/push/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error('push: server unsubscribe failed', err);
    }
    await sub.unsubscribe();
  } catch (err) {
    console.error('push: unsubscribe failed', err);
  }
}
