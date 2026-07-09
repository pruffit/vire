// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLazyQueue } from './use-play';
import type { LazyReleaseTrack } from './lazy-queue-fetchers';

function releaseResponse(tracks: LazyReleaseTrack[]) {
  return { ok: true, json: async () => ({ tracks }) } as Response;
}

/** Регрессия: bottom-sheet quick-look переиспользует один и тот же инстанс хука
 * для разных релизов (React переиспользует компонент при смене пропсов) — кэш и
 * inflight-промис не должны утекать в очередь другого id. */
describe('useLazyQueue', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('после смены id грузит и отдаёт очередь нового релиза, а не закэшированную старую', async () => {
    const trackA: LazyReleaseTrack = { id: 'track-a', title: 'A', version: null, trackNumber: 1, durationSec: 100, status: 'READY', credits: [] };
    const trackB: LazyReleaseTrack = { id: 'track-b', title: 'B', version: null, trackNumber: 1, durationSec: 120, status: 'READY', credits: [] };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(releaseResponse([trackA]))
      .mockResolvedValueOnce(releaseResponse([trackB]));
    vi.stubGlobal('fetch', fetchMock);

    const meta = { artistName: 'Artist', artistSlug: 'artist', coverUrl: null };
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useLazyQueue('release', id, meta),
      { initialProps: { id: 'release-a' } },
    );

    let queue = await act(async () => result.current.load());
    expect(queue?.map((t) => t.id)).toEqual(['track-a']);

    rerender({ id: 'release-b' });
    queue = await act(async () => result.current.load());
    expect(queue?.map((t) => t.id)).toEqual(['track-b']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('гонка: медленный fetch старого id резолвится после смены id — очередь остаётся новой', async () => {
    const trackA: LazyReleaseTrack = { id: 'track-a', title: 'A', version: null, trackNumber: 1, durationSec: 100, status: 'READY', credits: [] };
    const trackB: LazyReleaseTrack = { id: 'track-b', title: 'B', version: null, trackNumber: 1, durationSec: 120, status: 'READY', credits: [] };

    let resolveA!: (res: Response) => void;
    const slowA = new Promise<Response>((resolve) => {
      resolveA = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => slowA)
      .mockImplementationOnce(() => Promise.resolve(releaseResponse([trackB])));
    vi.stubGlobal('fetch', fetchMock);

    const meta = { artistName: 'Artist', artistSlug: 'artist', coverUrl: null };
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useLazyQueue('release', id, meta),
      { initialProps: { id: 'release-a' } },
    );

    // Стартуем load() для A, не дожидаясь ответа сети.
    let loadAPromise: Promise<unknown>;
    act(() => {
      loadAPromise = result.current.load();
    });

    rerender({ id: 'release-b' });
    const queueB = await act(async () => result.current.load());
    expect(queueB?.map((t) => t.id)).toEqual(['track-b']);

    // Только теперь резолвим медленный ответ по A — он не должен подменить уже показанную очередь B.
    let staleResult: unknown;
    await act(async () => {
      resolveA(releaseResponse([trackA]));
      staleResult = await loadAPromise;
    });

    // Обогнанный load() не должен отдать вызвавшему валидную очередь старого id — только null.
    expect(staleResult).toBeNull();

    const queueAgain = await act(async () => result.current.load());
    expect(queueAgain?.map((t) => t.id)).toEqual(['track-b']);
    expect(result.current.items?.map((t) => t.id)).toEqual(['track-b']);
  });
});
