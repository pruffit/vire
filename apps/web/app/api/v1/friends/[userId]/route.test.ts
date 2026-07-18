import { describe, it, expect, vi, beforeEach } from 'vitest';

const { unfriend } = vi.hoisted(() => ({
  unfriend: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/friends', () => ({
  friendshipService: () => ({ unfriend }),
}));

import { auth } from '@/auth';
import { DELETE } from './route';

const mockedAuth = vi.mocked(auth);
const OTHER_ID = 'other-1';
const SELF_ID = 'u1';
const ctx = { params: Promise.resolve({ userId: OTHER_ID }) };
const req = () => new Request(`http://localhost/api/v1/friends/${OTHER_ID}`, { method: 'DELETE' });

beforeEach(() => vi.clearAllMocks());

describe('DELETE /api/v1/friends/[userId]', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await DELETE(req(), ctx);
    expect(res.status).toBe(401);
    expect(unfriend).not.toHaveBeenCalled();
  });

  it('removes the friendship edge', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    unfriend.mockResolvedValue({ ok: true, value: undefined });
    const res = await DELETE(req(), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(unfriend).toHaveBeenCalledWith(SELF_ID, OTHER_ID);
  });
});
