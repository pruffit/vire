import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getWaveTracks, getTrackMusicalKey, getArtistIdsForTracks, getTasteProfile } = vi.hoisted(() => ({
  getWaveTracks: vi.fn(),
  getTrackMusicalKey: vi.fn(),
  getArtistIdsForTracks: vi.fn(),
  getTasteProfile: vi.fn(),
}));

const { getWaveSession, appendWaveServed, setWaveSessionSeed } = vi.hoisted(() => ({
  getWaveSession: vi.fn(),
  appendWaveServed: vi.fn(),
  setWaveSessionSeed: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 }),
  clientKey: vi.fn(() => 'wave:test'),
  tooManyRequests: vi.fn(),
}));
vi.mock('@/lib/wave-session', () => ({ getWaveSession, appendWaveServed, setWaveSessionSeed }));
vi.mock('@vire/db', () => ({
  getWaveTracks,
  getTrackMusicalKey,
  getArtistIdsForTracks,
  getTasteProfile,
  ALL_MOODS: ['HYPE', 'CHILL', 'DARK'],
  ALL_TRACK_GENRES: ['ELECTRONIC', 'HIPHOP', 'ROCK'],
}));

import { auth } from '@/auth';
import { GET } from './route';

const mockedAuth = vi.mocked(auth);

const TRACK: {
  id: string;
  title: string;
  artistName: string;
  artistSlug: string;
  releaseId: string;
  coverUrl: string | null;
  accentColor: string | null;
  isExplicit: boolean;
} = {
  id: 'track-1',
  title: 'Title',
  artistName: 'Artist',
  artistSlug: 'artist',
  releaseId: 'release-1',
  coverUrl: null,
  accentColor: null,
  isExplicit: false,
};

function req(query: string): Request {
  return new Request(`http://localhost/api/v1/wave${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedAuth.mockResolvedValue(null as never);
  getWaveSession.mockResolvedValue({ servedIds: [], mood: null, genre: null });
  appendWaveServed.mockResolvedValue(undefined);
  setWaveSessionSeed.mockResolvedValue(undefined);
  getWaveTracks.mockResolvedValue([TRACK]);
  getTrackMusicalKey.mockResolvedValue(null);
  getArtistIdsForTracks.mockResolvedValue([]);
  getTasteProfile.mockResolvedValue(null);
});

describe('GET /api/v1/wave', () => {
  it('400 on invalid mood', async () => {
    const res = await GET(req('?mood=NOT_A_MOOD'));
    expect(res.status).toBe(400);
    expect(getWaveTracks).not.toHaveBeenCalled();
  });

  it('400 on invalid genre', async () => {
    const res = await GET(req('?genre=NOT_A_GENRE'));
    expect(res.status).toBe(400);
    expect(getWaveTracks).not.toHaveBeenCalled();
  });

  it('400 when count exceeds max of 5', async () => {
    const res = await GET(req('?count=6'));
    expect(res.status).toBe(400);
    expect(getWaveTracks).not.toHaveBeenCalled();
  });

  it('happy path: excludeIds contains served ∪ played, response is a track array', async () => {
    getWaveSession.mockResolvedValue({ servedIds: ['served-1', 'served-2'], mood: null, genre: null });

    const res = await GET(req('?sessionId=session-abc123&played=played-1,played-2'));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { tracks: unknown[]; track: unknown };
    expect(body.tracks).toEqual([TRACK]);
    expect(body.track).toEqual(TRACK); // совместимость до B2

    expect(getWaveSession).toHaveBeenCalledWith('session-abc123');
    const call = getWaveTracks.mock.calls[0][0] as { excludeIds: string[] };
    expect(call.excludeIds).toEqual(
      expect.arrayContaining(['served-1', 'served-2', 'played-1', 'played-2']),
    );
    expect(appendWaveServed).toHaveBeenCalledWith('session-abc123', ['track-1']);
  });

  it('without sessionId, served is not read (stateless)', async () => {
    const res = await GET(req('?played=played-1'));
    expect(res.status).toBe(200);
    expect(getWaveSession).not.toHaveBeenCalled();
    const call = getWaveTracks.mock.calls[0][0] as { excludeIds: string[] };
    expect(call.excludeIds).toEqual(['played-1']);
    expect(appendWaveServed).not.toHaveBeenCalled();
  });

  it('degrades to 200 when the Redis-backed wave-session module throws', async () => {
    getWaveSession.mockRejectedValue(new Error('redis down'));
    appendWaveServed.mockRejectedValue(new Error('redis down'));

    const res = await GET(req('?sessionId=session-abc123'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tracks: unknown[] };
    expect(body.tracks).toEqual([TRACK]);
  });
});
