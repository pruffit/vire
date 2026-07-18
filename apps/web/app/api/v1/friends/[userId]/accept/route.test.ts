import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError } from '@vire/core';

const { accept } = vi.hoisted(() => ({
  accept: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/friends', () => ({
  friendshipService: () => ({ accept }),
}));

import { auth } from '@/auth';
import { POST } from './route';

const mockedAuth = vi.mocked(auth);
const OTHER_ID = 'other-1';
const SELF_ID = 'u1';
const ctx = { params: Promise.resolve({ userId: OTHER_ID }) };
const req = () => new Request(`http://localhost/api/v1/friends/${OTHER_ID}/accept`, { method: 'POST' });

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/friends/[userId]/accept', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(401);
    expect(accept).not.toHaveBeenCalled();
  });

  it('404 when there is no pending request', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    accept.mockResolvedValue({ ok: false, error: new NotFoundError('FriendRequest', OTHER_ID) });
    const res = await POST(req(), ctx);
    expect(res.status).toBe(404);
    expect(accept).toHaveBeenCalledWith(SELF_ID, OTHER_ID);
  });

  it('accepts the pending request', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    accept.mockResolvedValue({ ok: true, value: undefined });
    const res = await POST(req(), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(accept).toHaveBeenCalledWith(SELF_ID, OTHER_ID);
  });
});
