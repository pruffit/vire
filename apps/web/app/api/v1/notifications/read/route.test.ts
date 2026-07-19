import { describe, it, expect, vi, beforeEach } from 'vitest';

const { markAllRead } = vi.hoisted(() => ({ markAllRead: vi.fn() }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/notifications', () => ({ notificationService: () => ({ markAllRead }) }));

import { auth } from '@/auth';
import { POST } from './route';

const mockedAuth = vi.mocked(auth);
const SELF_ID = '22222222-2222-2222-2222-222222222222';

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/notifications/read', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST();
    expect(res.status).toBe(401);
    expect(markAllRead).not.toHaveBeenCalled();
  });

  it('marks all read', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    markAllRead.mockResolvedValue(undefined);
    const res = await POST();
    expect(res.status).toBe(200);
    expect(markAllRead).toHaveBeenCalledWith(SELF_ID);
  });
});
