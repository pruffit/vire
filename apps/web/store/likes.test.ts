// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@vire/api-client', () => ({ likeTrack: vi.fn() }));
vi.mock('@/lib/toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

import { likeTrack } from '@vire/api-client';
import { toast } from '@/lib/toast';
import { useLikesStore } from './likes';

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('useLikesStore.toggle', () => {
  beforeEach(() => {
    useLikesStore.setState({ state: {} });
    vi.mocked(likeTrack).mockReset();
    vi.mocked(toast.error).mockClear();
  });

  it('оптимистично флипает состояние и шлёт likeTrack с целевым значением', async () => {
    useLikesStore.setState({ state: { t1: false } });
    const { promise, resolve } = deferred<{ ok: true; data: { liked: boolean } }>();
    vi.mocked(likeTrack).mockReturnValue(promise as never);

    useLikesStore.getState().toggle('t1');

    expect(useLikesStore.getState().state.t1).toBe(true);
    expect(likeTrack).toHaveBeenCalledWith('t1', true);

    resolve({ ok: true, data: { liked: true } });
    await promise;
  });

  it('второй клик по тому же треку, пока первый запрос в полёте, не шлёт второй запрос', async () => {
    useLikesStore.setState({ state: { t1: false } });
    const { promise, resolve } = deferred<{ ok: true; data: { liked: boolean } }>();
    vi.mocked(likeTrack).mockReturnValue(promise as never);

    useLikesStore.getState().toggle('t1');
    useLikesStore.getState().toggle('t1');

    expect(likeTrack).toHaveBeenCalledTimes(1);
    expect(useLikesStore.getState().state.t1).toBe(true);

    resolve({ ok: true, data: { liked: true } });
    await promise;
  });

  it('откатывает состояние и показывает тост при ok:false', async () => {
    useLikesStore.setState({ state: { t1: false } });
    vi.mocked(likeTrack).mockResolvedValue({ ok: false, error: { status: 500, message: 'oops' } } as never);

    useLikesStore.getState().toggle('t1');
    expect(useLikesStore.getState().state.t1).toBe(true);

    await vi.waitFor(() => {
      expect(useLikesStore.getState().state.t1).toBe(false);
    });
    expect(toast.error).toHaveBeenCalledWith('Не удалось сохранить лайк');
  });

  it('после разрешения запроса повторный клик по треку снова шлёт запрос', async () => {
    useLikesStore.setState({ state: { t1: false } });
    vi.mocked(likeTrack).mockResolvedValue({ ok: true, data: { liked: true } } as never);

    await useLikesStore.getState().toggle('t1');
    await vi.waitFor(() => expect(likeTrack).toHaveBeenCalledTimes(1));

    vi.mocked(likeTrack).mockResolvedValue({ ok: true, data: { liked: false } } as never);
    useLikesStore.getState().toggle('t1');

    expect(likeTrack).toHaveBeenCalledTimes(2);
    expect(likeTrack).toHaveBeenLastCalledWith('t1', false);
  });

  it('no-op, если состояние трека ещё не загружено (undefined)', () => {
    useLikesStore.getState().toggle('unknown');
    expect(likeTrack).not.toHaveBeenCalled();
  });
});
