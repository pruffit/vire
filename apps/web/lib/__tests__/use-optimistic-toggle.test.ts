// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ApiResult } from '@vire/api-client';

vi.mock('@/lib/toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

import { useOptimisticToggle } from '../use-optimistic-toggle';
import { toast } from '@/lib/toast';

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('useOptimisticToggle', () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
  });

  it('оптимистично флипает флаг и счётчик до ответа сети', async () => {
    const { promise, resolve } = deferred<ApiResult<unknown>>();
    const request = vi.fn().mockReturnValue(promise);
    const { result } = renderHook(() => useOptimisticToggle({ id: 't1', initial: false, initialCount: 2, request }));

    act(() => {
      void result.current.toggle();
    });

    expect(result.current.on).toBe(true);
    expect(result.current.count).toBe(3);
    expect(result.current.pending).toBe(true);

    await act(async () => {
      resolve({ ok: true, data: {} });
      await promise;
    });
  });

  it('откатывает флаг/счётчик и показывает тост при ok:false', async () => {
    const request = vi.fn().mockResolvedValue({ ok: false, error: { status: 500, message: 'oops' } });
    const { result } = renderHook(() =>
      useOptimisticToggle({ id: 't1', initial: false, initialCount: 0, request, errorMessage: 'Не удалось сохранить' }),
    );

    await act(async () => {
      await result.current.toggle();
    });

    expect(result.current.on).toBe(false);
    expect(result.current.count).toBe(0);
    expect(result.current.pending).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Не удалось сохранить');
  });

  it('дефолтное сообщение об ошибке, если errorMessage не передан', async () => {
    const request = vi.fn().mockResolvedValue({ ok: false, error: { status: 500, message: 'oops' } });
    const { result } = renderHook(() => useOptimisticToggle({ id: 't1', initial: false, request }));

    await act(async () => {
      await result.current.toggle();
    });

    expect(toast.error).toHaveBeenCalledWith('Не удалось сохранить. Попробуй ещё раз');
  });

  it('двойной клик во время pending шлёт ровно один запрос', async () => {
    const { promise, resolve } = deferred<ApiResult<unknown>>();
    const request = vi.fn().mockReturnValue(promise);
    const { result } = renderHook(() => useOptimisticToggle({ id: 't1', initial: false, request }));

    act(() => {
      void result.current.toggle();
      void result.current.toggle();
    });

    expect(request).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve({ ok: true, data: {} });
      await promise;
    });
  });

  it('успех не откатывает состояние', async () => {
    const request = vi.fn().mockResolvedValue({ ok: true, data: {} });
    const { result } = renderHook(() => useOptimisticToggle({ id: 't1', initial: false, initialCount: 0, request }));

    await act(async () => {
      await result.current.toggle();
    });

    expect(result.current.on).toBe(true);
    expect(result.current.count).toBe(1);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('ресинкает состояние при смене id без ремаунта (переход между соседними сущностями)', () => {
    const request = vi.fn();
    const { result, rerender } = renderHook(
      (props: { id: string; initial: boolean; initialCount: number }) => useOptimisticToggle({ ...props, request }),
      { initialProps: { id: 'a', initial: true, initialCount: 10 } },
    );

    expect(result.current.on).toBe(true);
    expect(result.current.count).toBe(10);

    rerender({ id: 'b', initial: false, initialCount: 3 });

    expect(result.current.on).toBe(false);
    expect(result.current.count).toBe(3);
    expect(result.current.pending).toBe(false);
  });

  it('протухший ответ запроса для старого id не трогает состояние новой сущности', async () => {
    const { promise, resolve } = deferred<ApiResult<unknown>>();
    const request = vi.fn().mockReturnValue(promise);
    const { result, rerender } = renderHook(
      (props: { id: string; initial: boolean; initialCount: number }) => useOptimisticToggle({ ...props, request }),
      { initialProps: { id: 'a', initial: false, initialCount: 0 } },
    );

    act(() => {
      void result.current.toggle();
    });

    expect(result.current.on).toBe(true);
    expect(result.current.count).toBe(1);
    expect(result.current.pending).toBe(true);

    act(() => {
      rerender({ id: 'b', initial: false, initialCount: 5 });
    });

    expect(result.current.on).toBe(false);
    expect(result.current.count).toBe(5);
    expect(result.current.pending).toBe(false);

    await act(async () => {
      resolve({ ok: false, error: { status: 500, message: 'oops' } });
      await promise;
    });

    expect(result.current.on).toBe(false);
    expect(result.current.count).toBe(5);
    expect(result.current.pending).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
