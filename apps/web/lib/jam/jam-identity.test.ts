import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/session-signing', () => ({ verifySessionId: vi.fn() }));

import { auth } from '@/auth';
import { verifySessionId } from '@/lib/session-signing';
import { resolveJamIdentity } from './jam-identity';

const mockedAuth = vi.mocked(auth);
const mockedVerify = vi.mocked(verifySessionId);

beforeEach(() => vi.clearAllMocks());

describe('resolveJamIdentity', () => {
  it('returns userId identity for an authenticated session, ignoring any sessionId', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);

    const identity = await resolveJamIdentity('guest-signed.sig');

    expect(identity).toEqual({ userId: 'user-1' });
    expect(mockedVerify).not.toHaveBeenCalled();
  });

  it('returns guestSessionId identity for a valid signed sessionId', async () => {
    mockedAuth.mockResolvedValue(null as never);
    mockedVerify.mockReturnValue('guest-1');

    const identity = await resolveJamIdentity('guest-1.sig');

    expect(identity).toEqual({ guestSessionId: 'guest-1' });
    expect(mockedVerify).toHaveBeenCalledWith('guest-1.sig');
  });

  it('returns null for a forged/unsigned sessionId', async () => {
    mockedAuth.mockResolvedValue(null as never);
    mockedVerify.mockReturnValue(null);

    const identity = await resolveJamIdentity('forged-id');

    expect(identity).toBeNull();
  });

  it('returns null with no session and no sessionId', async () => {
    mockedAuth.mockResolvedValue(null as never);

    const identity = await resolveJamIdentity(undefined);

    expect(identity).toBeNull();
    expect(mockedVerify).not.toHaveBeenCalled();
  });
});
