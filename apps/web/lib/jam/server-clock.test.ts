// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useServerClock } from './server-clock';

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useServerClock', () => {
  it('выбирает офсет по замеру с наименьшим RTT', async () => {
    // 5 замеров, у второго RTT=10 (минимальный) — офсет должен взяться из него: 1300 - (200+210)/2 = 1095
    const t0t1 = [0, 100, 200, 210, 400, 450, 600, 650, 800, 850];
    let call = 0;
    // после 10 замеров возвращаем последнее значение — serverNow() в конце теста тоже дёргает Date.now()
    vi.spyOn(Date, 'now').mockImplementation(() => t0t1[Math.min(call++, t0t1.length - 1)]!);

    let fetchCall = 0;
    const tServer = [1000, 1300, 1500, 1700, 1900];
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ now: tServer[fetchCall++] }) })),
    );

    const { result } = renderHook(() => useServerClock());

    await waitFor(() => expect(result.current.offsetMs).toBe(1095));
    expect(fetch).toHaveBeenCalledTimes(5);
    expect(result.current.serverNow()).toBe(t0t1.at(-1)! + 1095);
  });

  it('отменяет in-flight запрос при размонтировании и не падает', async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort');
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    const { unmount } = renderHook(() => useServerClock());
    unmount();

    expect(abortSpy).toHaveBeenCalled();
  });

  it('деградирует молча при ошибке fetch — офсет остаётся прежним (0)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network down'))));

    const { result } = renderHook(() => useServerClock());

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.offsetMs).toBe(0);
  });

  it('деградирует молча, если сервер вернул не-ok', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false })));

    const { result } = renderHook(() => useServerClock());

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.offsetMs).toBe(0);
  });

  it('планирует ресинк раз в 5 минут и чистит таймер при размонтировании', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    const { unmount } = renderHook(() => useServerClock());

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5 * 60 * 1_000);
    const timerId = setIntervalSpy.mock.results[0]?.value;

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalledWith(timerId);
  });
});
