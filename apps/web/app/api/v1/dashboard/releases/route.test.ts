import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findByUserId, create, uploadToStream } = vi.hoisted(() => ({
  findByUserId: vi.fn(),
  create: vi.fn(),
  uploadToStream: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzleArtistRepository: class {
    findByUserId = findByUserId;
  },
  DrizzleReleaseRepository: class {
    create = create;
  },
}));
vi.mock('@/lib/s3', () => ({ uploadToStream }));

import { auth } from '@/auth';
import { POST } from './route';

const mockedAuth = vi.mocked(auth);

function makeReq(fields: Record<string, string | File>): Request {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return new Request('http://localhost/api/v1/dashboard/releases', { method: 'POST', body: fd });
}

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/dashboard/releases', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    expect((await POST(makeReq({ title: 'X', type: 'EP' }))).status).toBe(401);
  });

  it('403 when the user has no artist profile', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue(null);
    expect((await POST(makeReq({ title: 'X', type: 'EP' }))).status).toBe(403);
  });

  it('400 when the title is missing', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    const res = await POST(makeReq({ title: '   ', type: 'EP' }));
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('400 on an invalid release type', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    const res = await POST(makeReq({ title: 'X', type: 'MIXTAPE' }));
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('400 when the cover has an unsupported mime type', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    const res = await POST(
      makeReq({ title: 'X', type: 'EP', cover: new File([new Uint8Array([1])], 'c.gif', { type: 'image/gif' }) }),
    );
    expect(res.status).toBe(400);
    expect(uploadToStream).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('creates the release', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    create.mockResolvedValue({ id: 'rel-1' });
    const res = await POST(makeReq({ title: '  Neon  ', type: 'ALBUM' }));
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ releaseId: 'rel-1' });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ artistProfileId: 'artist1', title: 'Neon', type: 'ALBUM' }),
    );
  });
});
