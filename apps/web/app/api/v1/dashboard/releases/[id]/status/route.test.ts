import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findByUserId, findById, updateStatus, notifyAdd } = vi.hoisted(() => ({
  findByUserId: vi.fn(),
  findById: vi.fn(),
  updateStatus: vi.fn(),
  notifyAdd: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzleArtistRepository: class {
    findByUserId = findByUserId;
  },
  DrizzleReleaseRepository: class {
    findById = findById;
    updateStatus = updateStatus;
  },
}));
vi.mock('@/lib/queue', () => ({ notifyReleaseQueue: { add: notifyAdd } }));

import { auth } from '@/auth';
import { PATCH } from './route';

const mockedAuth = vi.mocked(auth);
const RELEASE_ID = '1321eb20-c9e6-4d95-b4e7-7e6a08fc8cf9';
const ctx = { params: Promise.resolve({ id: RELEASE_ID }) };

function makeReq(body: unknown): Request {
  return new Request(`http://localhost/api/v1/dashboard/releases/${RELEASE_ID}/status`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => vi.clearAllMocks());

describe('PATCH /api/v1/dashboard/releases/[id]/status', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    expect((await PATCH(makeReq({ status: 'PUBLISHED' }), ctx)).status).toBe(401);
  });

  it('403 when the user has no artist profile', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue(null);
    expect((await PATCH(makeReq({ status: 'PUBLISHED' }), ctx)).status).toBe(403);
  });

  it('404 when the release does not exist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    findById.mockResolvedValue(null);
    expect((await PATCH(makeReq({ status: 'PUBLISHED' }), ctx)).status).toBe(404);
  });

  it('403 when the release belongs to another artist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    findById.mockResolvedValue({ id: RELEASE_ID, artistProfileId: 'OTHER', status: 'DRAFT' });
    const res = await PATCH(makeReq({ status: 'PUBLISHED' }), ctx);
    expect(res.status).toBe(403);
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it('400 on an invalid status value', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    findById.mockResolvedValue({ id: RELEASE_ID, artistProfileId: 'artist1', status: 'DRAFT' });
    const res = await PATCH(makeReq({ status: 'NONSENSE' }), ctx);
    expect(res.status).toBe(400);
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it('updates status and notifies followers on first publish', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1', name: 'A', slug: 'a' });
    findById.mockResolvedValue({ id: RELEASE_ID, artistProfileId: 'artist1', status: 'DRAFT', title: 'T', type: 'EP', coverUrl: null });
    const res = await PATCH(makeReq({ status: 'PUBLISHED' }), ctx);
    expect(res.status).toBe(200);
    expect(updateStatus).toHaveBeenCalledWith(RELEASE_ID, 'PUBLISHED');
    expect(notifyAdd).toHaveBeenCalledOnce();
  });

  it('does not notify when moving to a non-published status', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1', name: 'A', slug: 'a' });
    findById.mockResolvedValue({ id: RELEASE_ID, artistProfileId: 'artist1', status: 'DRAFT' });
    const res = await PATCH(makeReq({ status: 'ARCHIVED' }), ctx);
    expect(res.status).toBe(200);
    expect(notifyAdd).not.toHaveBeenCalled();
  });
});
