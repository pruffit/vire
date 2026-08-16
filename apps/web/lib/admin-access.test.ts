import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));

import { auth } from '@/auth';
import { getAdminAccess } from './admin-access';

const mockedAuth = vi.mocked(auth);

beforeEach(() => vi.clearAllMocks());

describe('getAdminAccess', () => {
  it.each([
    ['VIEWER', { canModerate: false, canManageUsers: false, canRunJobs: false, canManageFlags: false }],
    ['MODERATOR', { canModerate: true, canManageUsers: false, canRunJobs: false, canManageFlags: false }],
    ['ADMIN', { canModerate: true, canManageUsers: true, canRunJobs: true, canManageFlags: true }],
    ['SUPERADMIN', { canModerate: true, canManageUsers: true, canRunJobs: true, canManageFlags: true }],
    ['LISTENER', { canModerate: false, canManageUsers: false, canRunJobs: false, canManageFlags: false }],
  ])('%s', async (role, expected) => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1', role } } as never);
    await expect(getAdminAccess()).resolves.toEqual(expected);
  });

  it('без сессии не даёт ни одного флага', async () => {
    mockedAuth.mockResolvedValue(null as never);
    await expect(getAdminAccess()).resolves.toEqual({
      canModerate: false,
      canManageUsers: false,
      canRunJobs: false,
      canManageFlags: false,
    });
  });
});
