import { describe, it, expect, vi, beforeEach } from 'vitest';

const { markSeen } = vi.hoisted(() => ({
  markSeen: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/friends', () => ({
  friendshipService: () => ({ markSeen }),
}));

import { auth } from '@/auth';
import { POST } from './route';

const mockedAuth = vi.mocked(auth);
const SELF_ID = '22222222-2222-2222-2222-222222222222';

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/friends/seen', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST();
    expect(res.status).toBe(401);
    expect(markSeen).not.toHaveBeenCalled();
  });

  it('marks requests seen for the current user', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    markSeen.mockResolvedValue(undefined);
    const res = await POST();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(markSeen).toHaveBeenCalledWith(SELF_ID);
  });
});
