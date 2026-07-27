// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const { sodiumReady, getIdentity, getOrCreateIdentity, getIdentityPubB64 } = vi.hoisted(() => ({
  sodiumReady: vi.fn().mockResolvedValue(undefined),
  getIdentity: vi.fn(),
  getOrCreateIdentity: vi.fn(),
  getIdentityPubB64: vi.fn(),
}));

vi.mock('./e2ee', () => ({
  sodiumReady,
  getIdentity,
  getOrCreateIdentity,
  getIdentityPubB64,
  toB64: (u: Uint8Array) => `b64:${Array.from(u).join(',')}`,
  fromB64: (s: string) => new Uint8Array(s.split(':')[1]?.split(',').map(Number) ?? []),
}));

import { useIdentity } from './e2ee-client';

const LOCAL_PUB = new Uint8Array([1, 2, 3]);
const LOCAL_PRIV = new Uint8Array([4, 5, 6]);

function postCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([, opts]) => (opts as RequestInit | undefined)?.method === 'POST');
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useIdentity — singleton-бутстрап на selfId', () => {
  it('локальная личность есть → ready с priv, публикует ikPub один раз', async () => {
    getIdentity.mockResolvedValue({ pub: LOCAL_PUB, priv: LOCAL_PRIV });
    getIdentityPubB64.mockResolvedValue('b64:1,2,3');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useIdentity('user-local-1'));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.priv).toEqual(LOCAL_PRIV);
    expect(result.current.needsLink).toBe(false);
    expect(postCalls(fetchMock)).toHaveLength(1);
    expect(postCalls(fetchMock)[0][0]).toBe('/api/v1/keys');
  });

  it('два параллельных монтажа с одним selfId → один POST /api/v1/keys (не два-три)', async () => {
    getIdentity.mockResolvedValue({ pub: LOCAL_PUB, priv: LOCAL_PRIV });
    getIdentityPubB64.mockResolvedValue('b64:1,2,3');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    vi.stubGlobal('fetch', fetchMock);

    const a = renderHook(() => useIdentity('user-concurrent'));
    const b = renderHook(() => useIdentity('user-concurrent'));

    await waitFor(() => expect(a.result.current.ready).toBe(true));
    await waitFor(() => expect(b.result.current.ready).toBe(true));

    expect(postCalls(fetchMock)).toHaveLength(1);
    expect(getIdentity).toHaveBeenCalledTimes(1);
  });

  it('повторный монтаж после завершения бутстрапа — 0 дополнительных запросов', async () => {
    getIdentity.mockResolvedValue({ pub: LOCAL_PUB, priv: LOCAL_PRIV });
    getIdentityPubB64.mockResolvedValue('b64:1,2,3');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    vi.stubGlobal('fetch', fetchMock);

    const first = renderHook(() => useIdentity('user-remount'));
    await waitFor(() => expect(first.result.current.ready).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = renderHook(() => useIdentity('user-remount'));
    await waitFor(() => expect(second.result.current.ready).toBe(true));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getIdentity).toHaveBeenCalledTimes(1);
  });

  it('нет локальной личности, сервер отдал чужой ikPub → needsLink, без POST', async () => {
    getIdentity.mockResolvedValue(null);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ikPub: 'b64:9,9,9' }) });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useIdentity('user-needs-link'));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.needsLink).toBe(true);
    expect(result.current.priv).toBeNull();
    expect(postCalls(fetchMock)).toHaveLength(0);
  });

  it('нет ни локальной, ни серверной личности → создаёт и публикует', async () => {
    getIdentity.mockResolvedValue(null);
    getOrCreateIdentity.mockResolvedValue({ pub: LOCAL_PUB, priv: LOCAL_PRIV });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ikPub: null }) });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useIdentity('user-fresh'));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.needsLink).toBe(false);
    expect(result.current.priv).toEqual(LOCAL_PRIV);
    expect(postCalls(fetchMock)).toHaveLength(1);
  });

  it('транзиентная сетевая ошибка не кешируется — следующий монтаж повторяет попытку', async () => {
    getIdentity.mockResolvedValue(null);
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    const failed = renderHook(() => useIdentity('user-retry'));
    await waitFor(() => expect(failed.result.current.error).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    getIdentity.mockResolvedValue({ pub: LOCAL_PUB, priv: LOCAL_PRIV });
    getIdentityPubB64.mockResolvedValue('b64:1,2,3');
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    const retried = renderHook(() => useIdentity('user-retry'));
    await waitFor(() => expect(retried.result.current.ready).toBe(true));
  });

  it('брошенное исключение (заблокированный IndexedDB) → error, а не залипший промис', async () => {
    getIdentity.mockRejectedValue(new Error('IndexedDB blocked'));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    vi.stubGlobal('fetch', fetchMock);

    const failed = renderHook(() => useIdentity('user-throw'));
    await waitFor(() => expect(failed.result.current.error).toBe(true));

    getIdentity.mockResolvedValue({ pub: LOCAL_PUB, priv: LOCAL_PRIV });
    getIdentityPubB64.mockResolvedValue('b64:1,2,3');

    const retried = renderHook(() => useIdentity('user-throw'));
    await waitFor(() => expect(retried.result.current.ready).toBe(true));
  });

  it('ретрай-таймер: ошибка → +15с → второй заход, успех даёт ready', async () => {
    vi.useFakeTimers();
    try {
      getIdentity.mockRejectedValue(new Error('network down'));
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
      vi.stubGlobal('fetch', fetchMock);

      const { result } = renderHook(() => useIdentity('user-retry-timer'));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(result.current.error).toBe(true);
      expect(getIdentity).toHaveBeenCalledTimes(1);

      getIdentity.mockResolvedValue({ pub: LOCAL_PUB, priv: LOCAL_PRIV });
      getIdentityPubB64.mockResolvedValue('b64:1,2,3');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000);
      });

      expect(getIdentity).toHaveBeenCalledTimes(2);
      expect(result.current.ready).toBe(true);
      expect(result.current.priv).toEqual(LOCAL_PRIV);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ретрай-таймер: размонтирование до срабатывания — повтора нет', async () => {
    vi.useFakeTimers();
    try {
      getIdentity.mockRejectedValue(new Error('network down'));
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
      vi.stubGlobal('fetch', fetchMock);

      const { result, unmount } = renderHook(() => useIdentity('user-retry-unmount'));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(result.current.error).toBe(true);
      expect(getIdentity).toHaveBeenCalledTimes(1);

      unmount();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000);
      });

      expect(getIdentity).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('не вызывает setState после анмаунта', async () => {
    getIdentity.mockResolvedValue(null);
    let resolveFetch: (v: unknown) => void = () => {};
    const fetchMock = vi.fn(() => new Promise((resolve) => { resolveFetch = resolve; }));
    vi.stubGlobal('fetch', fetchMock);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = renderHook(() => useIdentity('user-unmount'));
    unmount();
    resolveFetch({ ok: true, json: () => Promise.resolve({ ikPub: null }) });
    await new Promise((r) => setTimeout(r, 0));

    const warned = errorSpy.mock.calls.some((args) => String(args[0]).includes('unmounted'));
    expect(warned).toBe(false);
    errorSpy.mockRestore();
  });
});
