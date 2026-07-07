// @vitest-environment jsdom
import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.mock('@/components/toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

import { useTrackAnalysis } from './use-track-analysis';
import { toast } from '@/components/toast';

const MESSAGES = { pending: 'pending', start: 'start-err', timeout: 'timeout-err', success: 'ok' };
const ENDPOINTS = { analyze: '/api/analyze', snapshot: '/api/snapshot' };
const TIMEOUT_MS = 2 * 60 * 1_000;

describe('useTrackAnalysis', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(toast).mockClear();
    vi.mocked(toast.error).mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('завершается ошибкой по дедлайну, если начальный запрос завис (без вечного спиннера)', async () => {
    // baseline-GET никогда не резолвится — раньше это крутило спиннер бесконечно
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const onResult = vi.fn();
    const { result } = renderHook(() => useTrackAnalysis(ENDPOINTS, onResult, MESSAGES));

    act(() => {
      void result.current.start();
    });
    expect(result.current.status).toBe('running');
    expect(toast).toHaveBeenCalledWith('pending');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    });

    expect(result.current.status).toBe('error');
    expect(toast.error).toHaveBeenCalledWith('timeout-err');
    expect(onResult).not.toHaveBeenCalled();
  });

  it('happy path: baseline → POST → поллинг ловит смену updatedAt → done + onResult + success', async () => {
    let getCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, opts?: { method?: string }) => {
        if (opts?.method === 'POST') return Promise.resolve({ ok: true });
        getCount += 1;
        // baseline (1-й GET) — updatedAt null; поллинг (2-й) — уже проставлен
        const updatedAt = getCount === 1 ? null : '2026-01-01T00:00:00.000Z';
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ updatedAt }) });
      }),
    );
    const onResult = vi.fn();
    const { result } = renderHook(() => useTrackAnalysis(ENDPOINTS, onResult, MESSAGES));

    act(() => {
      void result.current.start();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(result.current.status).toBe('done');
    expect(onResult).toHaveBeenCalledWith({ updatedAt: '2026-01-01T00:00:00.000Z' });
    expect(toast).toHaveBeenCalledWith('ok');
  });

  it('под StrictMode (mount→unmount→remount) POST всё равно уходит и анализ доходит до done', async () => {
    // Регрессия: cleanup эффекта ставит disposedRef=true; без сброса в setup после
    // strict-mode ремаунта он залипает true, start() молча не шлёт POST — вечный
    // спиннер без ошибки (ровно баг прода). renderHook с StrictMode-обёрткой даёт
    // тот же mount→unmount→remount, что и dev.
    let getCount = 0;
    let postCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, opts?: { method?: string }) => {
        if (opts?.method === 'POST') {
          postCount += 1;
          return Promise.resolve({ ok: true });
        }
        getCount += 1;
        const updatedAt = getCount === 1 ? null : '2026-01-01T00:00:00.000Z';
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ updatedAt }) });
      }),
    );
    const onResult = vi.fn();
    const { result } = renderHook(() => useTrackAnalysis(ENDPOINTS, onResult, MESSAGES), {
      wrapper: StrictMode,
    });

    act(() => {
      void result.current.start();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(postCount).toBeGreaterThan(0);
    expect(result.current.status).toBe('done');
    expect(onResult).toHaveBeenCalledWith({ updatedAt: '2026-01-01T00:00:00.000Z' });
  });

  it('ошибка запуска, если POST вернул не-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, opts?: { method?: string }) => {
        if (opts?.method === 'POST') return Promise.resolve({ ok: false });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ updatedAt: null }) });
      }),
    );
    const onResult = vi.fn();
    const { result } = renderHook(() => useTrackAnalysis(ENDPOINTS, onResult, MESSAGES));

    act(() => {
      void result.current.start();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.status).toBe('error');
    expect(toast.error).toHaveBeenCalledWith('start-err');
    expect(onResult).not.toHaveBeenCalled();
  });
});
