import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks must be created via vi.hoisted so the hoisted vi.mock factories can
// reference them without a TDZ error.
const { findByUserId, uploadBuffer, transcodeAdd, releaseFindById, trackCreate } = vi.hoisted(() => ({
  findByUserId: vi.fn(),
  uploadBuffer: vi.fn(),
  transcodeAdd: vi.fn(),
  releaseFindById: vi.fn(),
  trackCreate: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 19, retryAfter: 0 }),
  clientKey: vi.fn().mockReturnValue('upload:test'),
  tooManyRequests: vi.fn(),
}));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzleArtistRepository: class {
    findByUserId = findByUserId;
  },
  DrizzleReleaseRepository: class {
    findById = releaseFindById;
  },
  DrizzleTrackRepository: class {
    create = trackCreate;
  },
}));
vi.mock('@/lib/s3', () => ({ uploadBuffer }));
vi.mock('@/lib/queue', () => ({ transcodeQueue: { add: transcodeAdd } }));

import { auth } from '@/auth';
import { POST } from './route';

const mockedAuth = vi.mocked(auth);
const RELEASE_ID = '1321eb20-c9e6-4d95-b4e7-7e6a08fc8cf9';

function makeReq(fields: Record<string, string | File>): Request {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return new Request('http://localhost/api/v1/dashboard/tracks/upload', {
    method: 'POST',
    body: fd,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/v1/dashboard/tracks/upload', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST(makeReq({}));
    expect(res.status).toBe(401);
    expect(uploadBuffer).not.toHaveBeenCalled();
  });

  it('403 when the user has no artist profile', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue(null);
    const res = await POST(makeReq({}));
    expect(res.status).toBe(403);
    expect(uploadBuffer).not.toHaveBeenCalled();
  });

  it('400 when required fields are missing', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    const res = await POST(makeReq({ title: 'Song' })); // no releaseId/file/number
    expect(res.status).toBe(400);
    expect(uploadBuffer).not.toHaveBeenCalled();
  });

  it('400 when the audio file is an unsupported format', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    const res = await POST(
      makeReq({
        releaseId: RELEASE_ID,
        title: 'Song',
        trackNumber: '1',
        file: new File([new Uint8Array([1, 2, 3])], 'track.aiff', { type: 'audio/aiff' }),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/WAV|FLAC|MP3/);
    expect(uploadBuffer).not.toHaveBeenCalled();
  });

  it('accepts a non-PCM (compressed) WAV — codec is left to the ffmpeg worker', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    releaseFindById.mockResolvedValue({ id: RELEASE_ID, artistProfileId: 'artist1' });
    trackCreate.mockResolvedValue({ id: 'track1', releaseId: RELEASE_ID });
    // Minimal RIFF/WAVE with a fmt chunk declaring audioFormat 0x0011 (IMA ADPCM).
    const wav = new Uint8Array(44);
    wav.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
    wav.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"
    wav.set([0x66, 0x6d, 0x74, 0x20], 12); // "fmt "
    new DataView(wav.buffer).setUint32(16, 16, true); // fmt size
    new DataView(wav.buffer).setUint16(20, 0x0011, true); // audioFormat = ADPCM
    const res = await POST(
      makeReq({
        releaseId: RELEASE_ID,
        title: 'Song',
        trackNumber: '1',
        file: new File([wav], 'track.wav', { type: 'audio/wav' }),
      }),
    );
    // Passes header validation and reaches the vault upload (no 400 on codec).
    expect(uploadBuffer).toHaveBeenCalled();
    expect(res.status).not.toBe(400);
  });

  it('400 on a malformed releaseId', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    const res = await POST(
      makeReq({
        releaseId: 'not-a-uuid',
        title: 'Song',
        trackNumber: '1',
        file: new File([new Uint8Array([1])], 'track.wav', { type: 'audio/wav' }),
      }),
    );
    expect(res.status).toBe(400);
    expect(uploadBuffer).not.toHaveBeenCalled();
  });
});
