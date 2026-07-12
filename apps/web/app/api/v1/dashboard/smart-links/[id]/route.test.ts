import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findByUserId, findById, slugTaken, update, deleteSmartLink, releaseOwnedByArtist, uploadToStream } = vi.hoisted(() => ({
  findByUserId: vi.fn(),
  findById: vi.fn(),
  slugTaken: vi.fn().mockResolvedValue(false),
  update: vi.fn(),
  deleteSmartLink: vi.fn(),
  releaseOwnedByArtist: vi.fn().mockResolvedValue(true),
  uploadToStream: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzleArtistRepository: class {
    findByUserId = findByUserId;
  },
  DrizzleSmartLinkRepository: class {
    findById = findById;
    slugTaken = slugTaken;
    update = update;
    delete = deleteSmartLink;
    releaseOwnedByArtist = releaseOwnedByArtist;
  },
}));
vi.mock('@/lib/s3', () => ({ uploadToStream }));

import { auth } from '@/auth';
import { PATCH, DELETE } from './route';

const mockedAuth = vi.mocked(auth);
const SL_ID = 'sl-1';
const ctx = { params: Promise.resolve({ id: SL_ID }) };

function patchReq(fields: Record<string, string | File>): Request {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return new Request(`http://localhost/api/v1/dashboard/smart-links/${SL_ID}`, { method: 'PATCH', body: fd });
}
const delReq = () =>
  new Request(`http://localhost/api/v1/dashboard/smart-links/${SL_ID}`, { method: 'DELETE' });

beforeEach(() => {
  vi.clearAllMocks();
  slugTaken.mockResolvedValue(false);
  releaseOwnedByArtist.mockResolvedValue(true);
});

describe('PATCH /api/v1/dashboard/smart-links/[id]', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    expect((await PATCH(patchReq({ title: 'X' }), ctx)).status).toBe(401);
  });

  it('403 when the user has no artist profile', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue(null);
    expect((await PATCH(patchReq({ title: 'X' }), ctx)).status).toBe(403);
  });

  it('404 when editing another artist’s smart link', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    findById.mockResolvedValue({ id: SL_ID, artistProfileId: 'OTHER', slug: 'x' });
    const res = await PATCH(patchReq({ title: 'X' }), ctx);
    expect(res.status).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });

  it('409 when the new slug is already taken', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    findById.mockResolvedValue({ id: SL_ID, artistProfileId: 'artist1', slug: 'old' });
    slugTaken.mockResolvedValue(true);
    const res = await PATCH(patchReq({ slug: 'new-slug' }), ctx);
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: 'Такой адрес уже занят' });
    expect(update).not.toHaveBeenCalled();
  });

  it('400 when the release is not owned by the artist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    findById.mockResolvedValue({ id: SL_ID, artistProfileId: 'artist1', slug: 'old' });
    releaseOwnedByArtist.mockResolvedValue(false);
    const res = await PATCH(patchReq({ releaseId: 'rel-1' }), ctx);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Релиз не найден' });
    expect(update).not.toHaveBeenCalled();
  });

  it('updates an owned smart link', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    findById.mockResolvedValue({ id: SL_ID, artistProfileId: 'artist1', slug: 'old' });
    const res = await PATCH(patchReq({ subtitle: '  hi  ' }), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith(SL_ID, 'artist1', expect.objectContaining({ subtitle: 'hi' }));
  });
});

describe('DELETE /api/v1/dashboard/smart-links/[id]', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    expect((await DELETE(delReq(), ctx)).status).toBe(401);
  });

  it('403 when the user has no artist profile', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue(null);
    expect((await DELETE(delReq(), ctx)).status).toBe(403);
  });

  it('404 when the smart link does not exist or belongs to another artist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    deleteSmartLink.mockResolvedValue(false);
    const res = await DELETE(delReq(), ctx);
    expect(res.status).toBe(404);
  });

  it('deletes an owned smart link', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    deleteSmartLink.mockResolvedValue(true);
    const res = await DELETE(delReq(), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(deleteSmartLink).toHaveBeenCalledWith(SL_ID, 'artist1');
  });
});
