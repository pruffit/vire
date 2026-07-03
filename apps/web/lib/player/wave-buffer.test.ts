import { describe, it, expect, vi, afterEach } from 'vitest';
import { needsWaveFetch, fetchWaveTracks } from './wave-buffer';

describe('needsWaveFetch', () => {
  const cases: Array<[queueLen: number, queueIndex: number, waveMode: boolean, inFlight: boolean, expected: boolean]> = [
    // waveMode выключен — никогда не запрашиваем, даже если остаток мал
    [3, 0, false, false, false],
    // уже идёт запрос — не дублируем
    [3, 0, true, true, false],
    // остаток 2 (индекс 0 из 3) — граница, ещё запрашиваем
    [3, 0, true, false, true],
    // остаток 3 — рано
    [4, 0, true, false, false],
    // остаток 1 — точно запрашиваем
    [3, 1, true, false, true],
    // остаток 0 (последний трек очереди, уже играет) — запрашиваем
    [3, 2, true, false, true],
    // длинная очередь, далеко от конца — не запрашиваем
    [10, 2, true, false, false],
    // длинная очередь, 2 трека до конца — запрашиваем
    [10, 7, true, false, true],
  ];

  it.each(cases)(
    'queueLen=%i queueIndex=%i waveMode=%s inFlight=%s → %s',
    (queueLen, queueIndex, waveMode, inFlight, expected) => {
      expect(needsWaveFetch(queueLen, queueIndex, waveMode, inFlight)).toBe(expected);
    },
  );
});

describe('fetchWaveTracks', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const validTrack = {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Track One',
    artistName: 'Artist',
    artistSlug: 'artist',
    releaseId: '22222222-2222-2222-2222-222222222222',
    coverUrl: 'https://cdn.example/cover.jpg',
    accentColor: null,
    isExplicit: false,
  };

  it('парсит валидный ответ и маппит accentColor null → undefined', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ tracks: [validTrack] }) }),
    );

    const result = await fetchWaveTracks({ sessionId: 'sess-1', played: [] });

    expect(result).toEqual([
      {
        id: validTrack.id,
        title: validTrack.title,
        artistName: validTrack.artistName,
        artistSlug: validTrack.artistSlug,
        releaseId: validTrack.releaseId,
        coverUrl: validTrack.coverUrl,
        accentColor: undefined,
        isExplicit: false,
      },
    ]);
  });

  it('сохраняет accentColor, когда сервер его прислал', async () => {
    const withColor = { ...validTrack, accentColor: '#ff0000' };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ tracks: [withColor] }) }),
    );

    const result = await fetchWaveTracks({ sessionId: 'sess-1', played: [] });

    expect(result[0].accentColor).toBe('#ff0000');
  });

  it('невалидный ответ (не проходит waveResponseSchema) → []', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ tracks: [{ id: 'not-a-uuid' }] }) }),
    );

    const result = await fetchWaveTracks({ sessionId: 'sess-1', played: [] });

    expect(result).toEqual([]);
  });

  it('не-ok ответ сети → []', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve(null) }));

    const result = await fetchWaveTracks({ sessionId: 'sess-1', played: [] });

    expect(result).toEqual([]);
  });

  it('сетевая ошибка → []', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));

    const result = await fetchWaveTracks({ sessionId: 'sess-1', played: [] });

    expect(result).toEqual([]);
  });

  it('строит query с trackId/mood/genre/played/count', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ tracks: [] }) });
    vi.stubGlobal('fetch', fetchMock);

    await fetchWaveTracks({
      sessionId: 'sess-1',
      trackId: 'track-1',
      mood: 'chill',
      genre: 'pop',
      played: ['a', 'b'],
      count: 5,
    });

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/v1/wave?');
    expect(calledUrl).toContain('sessionId=sess-1');
    expect(calledUrl).toContain('trackId=track-1');
    expect(calledUrl).toContain('mood=chill');
    expect(calledUrl).toContain('genre=pop');
    expect(calledUrl).toContain('played=a%2Cb');
    expect(calledUrl).toContain('count=5');
  });
});
