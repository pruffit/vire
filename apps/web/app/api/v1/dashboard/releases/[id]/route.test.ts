import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findByUserId, findById, update, uploadToStream } = vi.hoisted(() => ({
  findByUserId: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  uploadToStream: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzleArtistRepository: class {
    findByUserId = findByUserId;
  },
  DrizzleReleaseRepository: class {
    findById = findById;
    update = update;
  },
}));
vi.mock('@/lib/s3', () => ({ uploadToStream }));

import { auth } from '@/auth';
import { PATCH } from './route';

const mockedAuth = vi.mocked(auth);
const RELEASE_ID = 'rel-1';
const ctx = { params: Promise.resolve({ id: RELEASE_ID }) };

function makeReq(fields: Record<string, string | File>): Request {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return new Request(`http://localhost/api/v1/dashboard/releases/${RELEASE_ID}`, { method: 'PATCH', body: fd });
}

beforeEach(() => vi.clearAllMocks());

describe('PATCH /api/v1/dashboard/releases/[id]', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    expect((await PATCH(makeReq({ title: 'X', type: 'EP' }), ctx)).status).toBe(401);
  });

  it('403 when the user has no artist profile', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue(null);
    expect((await PATCH(makeReq({ title: 'X', type: 'EP' }), ctx)).status).toBe(403);
  });

  it('404 when the release does not exist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    findById.mockResolvedValue(null);
    expect((await PATCH(makeReq({ title: 'X', type: 'EP' }), ctx)).status).toBe(404);
  });

  it('403 when editing another artist’s release', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    findById.mockResolvedValue({ id: RELEASE_ID, artistProfileId: 'OTHER', coverUrl: null });
    const res = await PATCH(makeReq({ title: 'X', type: 'EP' }), ctx);
    expect(res.status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it('400 when the title is missing', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    findById.mockResolvedValue({ id: RELEASE_ID, artistProfileId: 'artist1', coverUrl: null });
    const res = await PATCH(makeReq({ title: '  ', type: 'EP' }), ctx);
    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('updates an owned release', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    findById.mockResolvedValue({ id: RELEASE_ID, artistProfileId: 'artist1', coverUrl: null });
    update.mockResolvedValue({ id: RELEASE_ID });
    const res = await PATCH(makeReq({ title: ' Title ', type: 'SINGLE' }), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ releaseId: RELEASE_ID });
    expect(update).toHaveBeenCalledWith(RELEASE_ID, expect.objectContaining({ title: 'Title', type: 'SINGLE' }));
  });
});
