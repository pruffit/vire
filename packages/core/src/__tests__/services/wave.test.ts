import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WaveService } from '../../services/wave';
import type { IWaveTrackSource, IWaveSessionStore } from '../../repositories/wave';
import type { WaveTrack, WaveSession, TasteProfile } from '../../types/wave';

const TRACK: WaveTrack = {
  id: 'track-1',
  title: 'Title',
  artistName: 'Artist',
  artistSlug: 'artist',
  releaseId: 'release-1',
  coverUrl: null,
  accentColor: null,
  isExplicit: false,
  version: null,
  feat: [],
};

const EMPTY_SESSION: WaveSession = { servedIds: [], recentServedIds: [], mood: null, genre: null };

function makeSource(overrides?: Partial<IWaveTrackSource>): IWaveTrackSource {
  return {
    getWaveTracks: vi.fn().mockResolvedValue([TRACK]),
    getTrackMusicalKey: vi.fn().mockResolvedValue(null),
    getArtistIdsForTracks: vi.fn().mockResolvedValue([]),
    getTasteProfile: vi.fn().mockResolvedValue({ topMoods: [], topGenres: [], topArtistIds: [] } as TasteProfile),
    ...overrides,
  };
}

function makeSessions(overrides?: Partial<IWaveSessionStore>): IWaveSessionStore {
  return {
    get: vi.fn().mockResolvedValue(EMPTY_SESSION),
    appendServed: vi.fn().mockResolvedValue(undefined),
    setSeed: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const baseInput = {
  sessionId: null as string | null,
  userId: null as string | null,
  mood: null as string | null,
  genre: null as string | null,
  currentTrackId: null as string | null,
  playedIds: [] as string[],
  limit: 3,
};

beforeEach(() => vi.clearAllMocks());

describe('WaveService.next', () => {
  it('returns tracks from the source', async () => {
    const source = makeSource();
    const sessions = makeSessions();
    const service = new WaveService(source, sessions);

    const result = await service.next(baseInput);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.tracks).toEqual([TRACK]);
  });

  it('without sessionId, the session store is never read and appendServed is not called', async () => {
    const source = makeSource();
    const sessions = makeSessions();
    const service = new WaveService(source, sessions);

    await service.next(baseInput);

    expect(sessions.get).not.toHaveBeenCalled();
    expect(sessions.appendServed).not.toHaveBeenCalled();
  });

  it('appendServed is called with returned track ids when tracks are non-empty', async () => {
    const source = makeSource({ getWaveTracks: vi.fn().mockResolvedValue([TRACK]) });
    const sessions = makeSessions();
    const service = new WaveService(source, sessions);

    await service.next({ ...baseInput, sessionId: 'sess-1' });

    expect(sessions.appendServed).toHaveBeenCalledWith('sess-1', ['track-1']);
  });

  it('appendServed is NOT called when the source returns an empty array', async () => {
    const source = makeSource({ getWaveTracks: vi.fn().mockResolvedValue([]) });
    const sessions = makeSessions();
    const service = new WaveService(source, sessions);

    await service.next({ ...baseInput, sessionId: 'sess-1' });

    expect(sessions.appendServed).not.toHaveBeenCalled();
  });

  it('collects exclusions from session servedIds + playedIds + currentTrackId', async () => {
    const source = makeSource();
    const sessions = makeSessions({
      get: vi.fn().mockResolvedValue({ servedIds: ['s1', 's2'], recentServedIds: [], mood: null, genre: null }),
    });
    const service = new WaveService(source, sessions);

    await service.next({ ...baseInput, sessionId: 'sess-1', currentTrackId: 'cur-1', playedIds: ['p1'] });

    const call = (source.getWaveTracks as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.excludeIds).toEqual(expect.arrayContaining(['s1', 's2', 'p1', 'cur-1']));
  });

  it('passes recentArtistIds derived from recentServedIds', async () => {
    const source = makeSource({ getArtistIdsForTracks: vi.fn().mockResolvedValue(['artist-9']) });
    const sessions = makeSessions({
      get: vi.fn().mockResolvedValue({ servedIds: [], recentServedIds: ['r1', 'r2'], mood: null, genre: null }),
    });
    const service = new WaveService(source, sessions);

    await service.next({ ...baseInput, sessionId: 'sess-1' });

    expect(source.getArtistIdsForTracks).toHaveBeenCalledWith(['r1', 'r2']);
    const call = (source.getWaveTracks as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.recentArtistIds).toEqual(['artist-9']);
  });

  it('getArtistIdsForTracks is not called when recentServedIds is empty', async () => {
    const source = makeSource();
    const sessions = makeSessions();
    const service = new WaveService(source, sessions);

    await service.next({ ...baseInput, sessionId: 'sess-1' });

    expect(source.getArtistIdsForTracks).not.toHaveBeenCalled();
  });

  it('fetches the taste profile only when userId is set (anonymous → null)', async () => {
    const source = makeSource();
    const sessions = makeSessions();
    const service = new WaveService(source, sessions);

    await service.next({ ...baseInput, userId: null });
    expect(source.getTasteProfile).not.toHaveBeenCalled();

    const call1 = (source.getWaveTracks as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call1.taste).toBeNull();

    await service.next({ ...baseInput, userId: 'user-1' });
    expect(source.getTasteProfile).toHaveBeenCalledWith('user-1');
  });

  it('seed mode (no currentTrackId): query mood/genre become seedMood/seedGenre, sessionMood/Genre stay null', async () => {
    const source = makeSource();
    const sessions = makeSessions();
    const service = new WaveService(source, sessions);

    await service.next({ ...baseInput, mood: 'HYPE', genre: 'ELECTRONIC' });

    const call = (source.getWaveTracks as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.seedMood).toBe('HYPE');
    expect(call.seedGenre).toBe('ELECTRONIC');
    expect(call.sessionMood).toBeNull();
    expect(call.sessionGenre).toBeNull();
  });

  it('similarity mode (currentTrackId set): query mood/genre become sessionMood/sessionGenre', async () => {
    const source = makeSource();
    const sessions = makeSessions();
    const service = new WaveService(source, sessions);

    await service.next({ ...baseInput, currentTrackId: 'cur-1', mood: 'CHILL', genre: 'ROCK' });

    const call = (source.getWaveTracks as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.sessionMood).toBe('CHILL');
    expect(call.sessionGenre).toBe('ROCK');
    expect(call.seedMood).toBeNull();
    expect(call.seedGenre).toBeNull();
  });

  it('seed already pinned in session → setSeed is not called again (query still wins the scoring value for this request)', async () => {
    const source = makeSource();
    const sessions = makeSessions({
      get: vi.fn().mockResolvedValue({ servedIds: [], recentServedIds: [], mood: 'HYPE', genre: null }),
    });
    const service = new WaveService(source, sessions);

    await service.next({ ...baseInput, sessionId: 'sess-1', mood: 'CHILL' });

    const call = (source.getWaveTracks as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.seedMood).toBe('CHILL');
    expect(sessions.setSeed).not.toHaveBeenCalled();
  });

  it('no mood in query, session already has a pinned mood → that pinned mood is used', async () => {
    const source = makeSource();
    const sessions = makeSessions({
      get: vi.fn().mockResolvedValue({ servedIds: [], recentServedIds: [], mood: 'HYPE', genre: null }),
    });
    const service = new WaveService(source, sessions);

    await service.next({ ...baseInput, sessionId: 'sess-1' });

    const call = (source.getWaveTracks as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.seedMood).toBe('HYPE');
  });

  it('empty session + mood/genre in the request (first request of the session) → setSeed is called once', async () => {
    const source = makeSource();
    const sessions = makeSessions();
    const service = new WaveService(source, sessions);

    await service.next({ ...baseInput, sessionId: 'sess-1', mood: 'HYPE' });

    expect(sessions.setSeed).toHaveBeenCalledWith('sess-1', { mood: 'HYPE', genre: undefined });
  });

  it('musicalKey/keySets are only computed when currentTrackId is set', async () => {
    const source = makeSource({ getTrackMusicalKey: vi.fn().mockResolvedValue('8B') });
    const sessions = makeSessions();
    const service = new WaveService(source, sessions);

    await service.next({ ...baseInput, currentTrackId: 'cur-1' });
    expect(source.getTrackMusicalKey).toHaveBeenCalledWith('cur-1');
    const call = (source.getWaveTracks as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.keySets).not.toBeNull();

    vi.clearAllMocks();
    const source2 = makeSource();
    const service2 = new WaveService(source2, makeSessions());
    await service2.next(baseInput);
    expect(source2.getTrackMusicalKey).not.toHaveBeenCalled();
  });
});
