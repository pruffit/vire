import { describe, it, expect, vi, beforeEach } from 'vitest';

const { trackExists, hasPurchasedTrack, getTrackAudio, getSourceDownloadUrl, redirect } = vi.hoisted(() => ({
  trackExists: vi.fn(),
  hasPurchasedTrack: vi.fn(),
  getTrackAudio: vi.fn(),
  getSourceDownloadUrl: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({ trackExists, hasPurchasedTrack, getTrackAudio }));
vi.mock('@/lib/s3', () => ({ getSourceDownloadUrl }));
vi.mock('next/navigation', () => ({ redirect }));

import { auth } from '@/auth';
import { GET } from './route';

const mockedAuth = vi.mocked(auth);
const TRACK_ID = 'track-1';
const ctx = { params: Promise.resolve({ id: TRACK_ID }) };
const req = () => new Request(`http://localhost/api/v1/tracks/${TRACK_ID}/download?filename=song`);

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/tracks/[id]/download', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    expect((await GET(req(), ctx))!.status).toBe(401);
  });

  it('404 when the track does not exist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    trackExists.mockResolvedValue(false);
    expect((await GET(req(), ctx))!.status).toBe(404);
  });

  it('403 when the track has not been purchased', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    trackExists.mockResolvedValue(true);
    hasPurchasedTrack.mockResolvedValue(false);
    const res = await GET(req(), ctx);
    expect(res!.status).toBe(403);
    expect(getSourceDownloadUrl).not.toHaveBeenCalled();
  });

  it('404 when the master is not ready', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    trackExists.mockResolvedValue(true);
    hasPurchasedTrack.mockResolvedValue(true);
    getTrackAudio.mockResolvedValue({ flacKey: null });
    expect((await GET(req(), ctx))!.status).toBe(404);
  });

  it('redirects an owner to a signed URL', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    trackExists.mockResolvedValue(true);
    hasPurchasedTrack.mockResolvedValue(true);
    getTrackAudio.mockResolvedValue({ flacKey: 'vault/tracks/track-1/source.wav' });
    getSourceDownloadUrl.mockResolvedValue('https://s3.example/signed');

    await GET(req(), ctx);
    expect(getSourceDownloadUrl).toHaveBeenCalledWith('vault/tracks/track-1/source.wav', 'song');
    expect(redirect).toHaveBeenCalledWith('https://s3.example/signed');
  });
});
