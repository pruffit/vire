import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findByUserId, getArtistPostById, updateArtistPost, deleteArtistPost } = vi.hoisted(() => ({
  findByUserId: vi.fn(),
  getArtistPostById: vi.fn(),
  updateArtistPost: vi.fn(),
  deleteArtistPost: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzleArtistRepository: class {
    findByUserId = findByUserId;
  },
  getArtistPostById,
  updateArtistPost,
  deleteArtistPost,
}));

import { auth } from '@/auth';
import { PATCH, DELETE } from './route';

const mockedAuth = vi.mocked(auth);
const POST_ID = 'p1';
const ctx = { params: Promise.resolve({ id: POST_ID }) };

function patchReq(body: unknown): Request {
  return new Request(`http://localhost/api/v1/dashboard/posts/${POST_ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
const delReq = () =>
  new Request(`http://localhost/api/v1/dashboard/posts/${POST_ID}`, { method: 'DELETE' });

beforeEach(() => vi.clearAllMocks());

describe('PATCH /api/v1/dashboard/posts/[id]', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    expect((await PATCH(patchReq({ body: 'x' }), ctx)).status).toBe(401);
  });

  it('404 when the post does not exist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    getArtistPostById.mockResolvedValue(null);
    expect((await PATCH(patchReq({ body: 'x' }), ctx)).status).toBe(404);
  });

  it('403 when editing another artist’s post', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    getArtistPostById.mockResolvedValue({ id: POST_ID, artistProfileId: 'OTHER' });
    const res = await PATCH(patchReq({ body: 'x' }), ctx);
    expect(res.status).toBe(403);
    expect(updateArtistPost).not.toHaveBeenCalled();
  });

  it('400 when body is empty', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    getArtistPostById.mockResolvedValue({ id: POST_ID, artistProfileId: 'artist1' });
    const res = await PATCH(patchReq({ body: '  ' }), ctx);
    expect(res.status).toBe(400);
    expect(updateArtistPost).not.toHaveBeenCalled();
  });

  it('updates an owned post', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    getArtistPostById.mockResolvedValue({ id: POST_ID, artistProfileId: 'artist1' });
    const res = await PATCH(patchReq({ title: ' New ', body: ' Body ' }), ctx);
    expect(res.status).toBe(200);
    expect(updateArtistPost).toHaveBeenCalledWith(POST_ID, { title: 'New', body: 'Body' });
  });
});

describe('DELETE /api/v1/dashboard/posts/[id]', () => {
  it('403 when deleting another artist’s post', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    getArtistPostById.mockResolvedValue({ id: POST_ID, artistProfileId: 'OTHER' });
    const res = await DELETE(delReq(), ctx);
    expect(res.status).toBe(403);
    expect(deleteArtistPost).not.toHaveBeenCalled();
  });

  it('deletes an owned post', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    getArtistPostById.mockResolvedValue({ id: POST_ID, artistProfileId: 'artist1' });
    const res = await DELETE(delReq(), ctx);
    expect(res.status).toBe(200);
    expect(deleteArtistPost).toHaveBeenCalledWith(POST_ID);
  });
});
