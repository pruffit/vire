// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

async function loadModule(vapid: string | undefined) {
  vi.resetModules();
  if (vapid === undefined) delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  else process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = vapid;
  return import('./push-client');
}

function stubSupport({ notification = true, serviceWorker = true, pushManager = true }: { notification?: boolean; serviceWorker?: boolean; pushManager?: boolean } = {}) {
  if (notification) {
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn().mockResolvedValue('granted') });
  } else {
    vi.stubGlobal('Notification', undefined);
  }
  if (serviceWorker) {
    Object.defineProperty(window.navigator, 'serviceWorker', {
      value: { register: vi.fn(), getRegistration: vi.fn().mockResolvedValue(null) },
      configurable: true,
    });
  } else {
    Object.defineProperty(window.navigator, 'serviceWorker', { value: undefined, configurable: true });
  }
  if (pushManager) (window as unknown as { PushManager: unknown }).PushManager = class {};
  else delete (window as unknown as { PushManager?: unknown }).PushManager;
}

const VAPID = 'BNbxGYNMhEMdpxJRJHvJPhSgHrp6XLm4Kzs3oB6XyLTM6jJZuXhE7WwmQK6ie9-6YrXlwR2Q7zJVX7-3iqSbHKI';

beforeEach(() => {
  stubSupport();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getPushState', () => {
  it('нет VAPID → unsupported', async () => {
    const { getPushState } = await loadModule(undefined);
    expect(await getPushState()).toBe('unsupported');
  });

  it('нет Notification в браузере → unsupported', async () => {
    stubSupport({ notification: false });
    const { getPushState } = await loadModule(VAPID);
    expect(await getPushState()).toBe('unsupported');
  });

  it('permission denied → denied', async () => {
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission: vi.fn() });
    const { getPushState } = await loadModule(VAPID);
    expect(await getPushState()).toBe('denied');
  });

  it('есть активная подписка → subscribed', async () => {
    Object.defineProperty(window.navigator, 'serviceWorker', {
      value: {
        register: vi.fn(),
        getRegistration: vi.fn().mockResolvedValue({ pushManager: { getSubscription: vi.fn().mockResolvedValue({ endpoint: 'x' }) } }),
      },
      configurable: true,
    });
    const { getPushState } = await loadModule(VAPID);
    expect(await getPushState()).toBe('subscribed');
  });

  it('нет подписки → unsubscribed', async () => {
    const { getPushState } = await loadModule(VAPID);
    expect(await getPushState()).toBe('unsubscribed');
  });
});

describe('subscribeToPush', () => {
  it('окружение не поддерживает push → reason sw', async () => {
    stubSupport({ serviceWorker: false });
    const { subscribeToPush } = await loadModule(VAPID);
    expect(await subscribeToPush()).toEqual({ ok: false, reason: 'sw' });
  });

  it('пользователь отклонил разрешение → reason permission', async () => {
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn().mockResolvedValue('denied') });
    const { subscribeToPush } = await loadModule(VAPID);
    expect(await subscribeToPush()).toEqual({ ok: false, reason: 'permission' });
  });

  it('requestPermission кидает исключение → reason permission, не пробрасывается наружу', async () => {
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn().mockRejectedValue(new Error('boom')) });
    const { subscribeToPush } = await loadModule(VAPID);
    await expect(subscribeToPush()).resolves.toEqual({ ok: false, reason: 'permission' });
  });

  it('serviceWorker.register падает → reason sw', async () => {
    Object.defineProperty(window.navigator, 'serviceWorker', {
      value: { register: vi.fn().mockRejectedValue(new Error('no sw')), getRegistration: vi.fn() },
      configurable: true,
    });
    const { subscribeToPush } = await loadModule(VAPID);
    expect(await subscribeToPush()).toEqual({ ok: false, reason: 'sw' });
  });

  it('pushManager.subscribe падает (push-сервис недоступен) → reason push-service', async () => {
    Object.defineProperty(window.navigator, 'serviceWorker', {
      value: {
        register: vi.fn().mockResolvedValue({ pushManager: { subscribe: vi.fn().mockRejectedValue(new Error('fcm down')) } }),
        getRegistration: vi.fn(),
      },
      configurable: true,
    });
    const { subscribeToPush } = await loadModule(VAPID);
    expect(await subscribeToPush()).toEqual({ ok: false, reason: 'push-service' });
  });

  it('сервер отклонил подписку → reason server, откатывает браузерную подписку', async () => {
    const unsubscribe = vi.fn().mockResolvedValue(undefined);
    const sub = { toJSON: () => ({ endpoint: 'e', keys: { p256dh: 'a', auth: 'b' } }), unsubscribe };
    Object.defineProperty(window.navigator, 'serviceWorker', {
      value: { register: vi.fn().mockResolvedValue({ pushManager: { subscribe: vi.fn().mockResolvedValue(sub) } }), getRegistration: vi.fn() },
      configurable: true,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const { subscribeToPush } = await loadModule(VAPID);
    expect(await subscribeToPush()).toEqual({ ok: false, reason: 'server' });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('всё успешно → ok true, POST на /api/v1/push/subscribe', async () => {
    const sub = { toJSON: () => ({ endpoint: 'e', keys: { p256dh: 'a', auth: 'b' } }), unsubscribe: vi.fn() };
    Object.defineProperty(window.navigator, 'serviceWorker', {
      value: { register: vi.fn().mockResolvedValue({ pushManager: { subscribe: vi.fn().mockResolvedValue(sub) } }), getRegistration: vi.fn() },
      configurable: true,
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const { subscribeToPush } = await loadModule(`  ${VAPID}  `);
    await expect(subscribeToPush()).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/push/subscribe', expect.objectContaining({ method: 'POST' }));
  });
});

describe('unsubscribeFromPush', () => {
  it('нет активной подписки — ничего не делает, не кидает', async () => {
    const { unsubscribeFromPush } = await loadModule(VAPID);
    await expect(unsubscribeFromPush()).resolves.toBeUndefined();
  });

  it('сервер отвечает ошибкой на DELETE — не пробрасывает исключение, всё равно отписывает локально', async () => {
    const unsubscribe = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'serviceWorker', {
      value: {
        register: vi.fn(),
        getRegistration: vi.fn().mockResolvedValue({ pushManager: { getSubscription: vi.fn().mockResolvedValue({ endpoint: 'e', unsubscribe }) } }),
      },
      configurable: true,
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const { unsubscribeFromPush } = await loadModule(VAPID);
    await expect(unsubscribeFromPush()).resolves.toBeUndefined();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('getRegistration кидает исключение — не пробрасывается наружу', async () => {
    Object.defineProperty(window.navigator, 'serviceWorker', {
      value: { register: vi.fn(), getRegistration: vi.fn().mockRejectedValue(new Error('boom')) },
      configurable: true,
    });
    const { unsubscribeFromPush } = await loadModule(VAPID);
    await expect(unsubscribeFromPush()).resolves.toBeUndefined();
  });
});
