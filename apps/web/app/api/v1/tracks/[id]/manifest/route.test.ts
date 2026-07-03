import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getPlayableTrackAudio, getTrackAudio, getTrackArtistProfileId, findByIdForUser, rateLimit, tooManyRequests } = vi.hoisted(() => ({
  getPlayableTrackAudio: vi.fn(),
  getTrackAudio: vi.fn(),
  getTrackArtistProfileId: vi.fn(),
  findByIdForUser: vi.fn(),
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 }),
  tooManyRequests: vi.fn(() => new Response(null, { status: 429 })),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit,
  clientKey: vi.fn(() => 'manifest:test'),
  tooManyRequests,
}));
vi.mock('@vire/db', () => ({
  db: {},
  getPlayableTrackAudio,
  getTrackAudio,
  getTrackArtistProfileId,
  DrizzleArtistRepository: class {
    findByIdForUser = findByIdForUser;
  },
}));

import { auth } from '@/auth';
import { GET } from './route';

const mockedAuth = vi.mocked(auth);
const TRACK_ID = 'track-1';
const ctx = { params: Promise.resolve({ id: TRACK_ID }) };
const req = () => new Request(`http://localhost/api/v1/tracks/${TRACK_ID}/manifest`);

const AUDIO = {
  hlsManifestKey: 'streams/track-1/master.m3u8',
  waveformPeaks: [1, 2, 3],
  bpm: 120,
  musicalKey: '8A',
  flacKey: 'vault/track-1/source.flac',
};

beforeEach(() => {
  vi.clearAllMocks();
  rateLimit.mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 });
});

describe('GET /api/v1/tracks/[id]/manifest', () => {
  it('429 when rate-limited', async () => {
    rateLimit.mockResolvedValue({ ok: false, remaining: 0, retryAfter: 60 });
    const res = await GET(req(), ctx);
    expect(res.status).toBe(429);
    expect(getPlayableTrackAudio).not.toHaveBeenCalled();
  });

  it('200 for a READY track in a published release', async () => {
    getPlayableTrackAudio.mockResolvedValue({ ...AUDIO, artistProfileId: 'artist-1' });
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { hlsUrl: string; waveformPeaks: number[] };
    expect(body.hlsUrl).toContain(AUDIO.hlsManifestKey);
    expect(body.waveformPeaks).toEqual(AUDIO.waveformPeaks);
    expect(getTrackAudio).not.toHaveBeenCalled();
  });

  it('404 for a PROCESSING track requested anonymously', async () => {
    getPlayableTrackAudio.mockResolvedValue(null);
    mockedAuth.mockResolvedValue(null as never);
    const res = await GET(req(), ctx);
    expect(res.status).toBe(404);
    expect(getTrackAudio).not.toHaveBeenCalled();
  });

  it('404 for a track in an unpublished release requested anonymously', async () => {
    getPlayableTrackAudio.mockResolvedValue(null);
    mockedAuth.mockResolvedValue(null as never);
    const res = await GET(req(), ctx);
    expect(res.status).toBe(404);
  });

  it('200 for the owning artist even when the track is not yet playable', async () => {
    getPlayableTrackAudio.mockResolvedValue(null);
    mockedAuth.mockResolvedValue({ user: { id: 'u1', role: 'ARTIST' } } as never);
    getTrackArtistProfileId.mockResolvedValue('artist-1');
    findByIdForUser.mockResolvedValue({ id: 'artist-1' });
    getTrackAudio.mockResolvedValue(AUDIO);

    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    expect(findByIdForUser).toHaveBeenCalledWith('artist-1', 'u1');
  });

  it('404 for an authenticated non-owner listener', async () => {
    getPlayableTrackAudio.mockResolvedValue(null);
    mockedAuth.mockResolvedValue({ user: { id: 'u2', role: 'LISTENER' } } as never);
    getTrackArtistProfileId.mockResolvedValue('artist-1');
    findByIdForUser.mockResolvedValue(null);

    const res = await GET(req(), ctx);
    expect(res.status).toBe(404);
    expect(getTrackAudio).not.toHaveBeenCalled();
  });

  it('200 for a MODERATOR/ADMIN/SUPERADMIN even without ownership', async () => {
    getPlayableTrackAudio.mockResolvedValue(null);
    mockedAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never);
    getTrackAudio.mockResolvedValue(AUDIO);

    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    expect(getTrackArtistProfileId).not.toHaveBeenCalled();
  });
});
