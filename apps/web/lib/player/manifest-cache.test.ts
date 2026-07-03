import { describe, it, expect, vi, afterEach } from 'vitest';
import { getCachedManifest, putCachedManifest, fetchManifest, type ManifestData } from './manifest-cache';

function manifest(n: number): ManifestData {
  return { hlsUrl: `https://cdn.example/${n}.m3u8`, waveformPeaks: [n] };
}

describe('manifest-cache', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('кэш-промах → undefined', () => {
    expect(getCachedManifest('unknown-track-1')).toBeUndefined();
  });

  it('put затем get возвращает те же данные', () => {
    putCachedManifest('track-a', manifest(1));
    expect(getCachedManifest('track-a')).toEqual(manifest(1));
  });

  it('вытесняет самый старый элемент при превышении лимита в 10', () => {
    for (let i = 0; i < 10; i++) {
      putCachedManifest(`evict-${i}`, manifest(i));
    }
    // Все 10 ещё в кэше
    expect(getCachedManifest('evict-0')).toEqual(manifest(0));

    // 11-й вытесняет самый старый (evict-0, ещё не тронутый через get выше... но мы его только что get'нули,
    // что делает его недавно использованным — проверяем на независимом наборе ниже отдельно)
    putCachedManifest('evict-10', manifest(10));
    expect(getCachedManifest('evict-1')).toBeUndefined();
    expect(getCachedManifest('evict-10')).toEqual(manifest(10));
  });

  it('get «трогает» запись — недавно прочитанная переживает вытеснение', () => {
    for (let i = 0; i < 10; i++) {
      putCachedManifest(`touch-${i}`, manifest(i));
    }
    // Читаем самый старый — теперь он «свежий»
    getCachedManifest('touch-0');
    // Следующая запись должна вытеснить touch-1 (теперь самый старый), а не touch-0
    putCachedManifest('touch-10', manifest(10));
    expect(getCachedManifest('touch-0')).toEqual(manifest(0));
    expect(getCachedManifest('touch-1')).toBeUndefined();
  });

  it('fetchManifest: кэш-хит не вызывает fetch', async () => {
    putCachedManifest('cached-track', manifest(42));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchManifest('cached-track');

    expect(result).toEqual(manifest(42));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetchManifest: промах → fetch и запись в кэш', async () => {
    const data = manifest(99);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(data),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchManifest('fresh-track');

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/tracks/fresh-track/manifest');
    expect(result).toEqual(data);
    expect(getCachedManifest('fresh-track')).toEqual(data);
  });

  it('fetchManifest: повторный вызов на тот же трек не бьёт fetch снова', async () => {
    const data = manifest(7);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(data),
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchManifest('repeat-track');
    await fetchManifest('repeat-track');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetchManifest: сетевая ошибка → null, не кэшируется', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const result = await fetchManifest('broken-track');
    expect(result).toBeNull();
    expect(getCachedManifest('broken-track')).toBeUndefined();
  });

  it('fetchManifest: не-ok ответ → null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve(null) }));
    const result = await fetchManifest('not-found-track');
    expect(result).toBeNull();
  });
});
