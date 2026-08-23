import { describe, expect, it, vi, beforeEach } from 'vitest';

const { getCurrentUserId } = vi.hoisted(() => ({ getCurrentUserId: vi.fn() }));
vi.mock('../../secure-store', () => ({ getCurrentUserId }));

const { getOrCreateIdentity } = vi.hoisted(() => ({ getOrCreateIdentity: vi.fn() }));
vi.mock('../identity', () => ({ getOrCreateIdentity }));

const { publishIdentityKey } = vi.hoisted(() => ({ publishIdentityKey: vi.fn() }));
vi.mock('../publish-key', () => ({ publishIdentityKey }));

import { bootstrapE2eeIdentity } from '../bootstrap';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('e2ee/bootstrap', () => {
  it('does nothing when there is no logged-in user', async () => {
    getCurrentUserId.mockResolvedValue(null);

    await bootstrapE2eeIdentity();

    expect(getOrCreateIdentity).not.toHaveBeenCalled();
    expect(publishIdentityKey).not.toHaveBeenCalled();
  });

  it('creates/loads the identity and publishes its public key when logged in', async () => {
    getCurrentUserId.mockResolvedValue('user-1');
    getOrCreateIdentity.mockResolvedValue({ pub: new Uint8Array(32).fill(7), priv: new Uint8Array(32).fill(9) });
    publishIdentityKey.mockResolvedValue(true);

    await bootstrapE2eeIdentity();

    expect(getOrCreateIdentity).toHaveBeenCalledWith('user-1');
    expect(publishIdentityKey).toHaveBeenCalledTimes(1);
    const publishedArg = publishIdentityKey.mock.calls[0][0];
    expect(typeof publishedArg).toBe('string');
    expect(publishedArg).toMatch(/^[A-Za-z0-9+/]{43}=$/);
  });

  it('does not throw when a dependency rejects (SecureStore unavailable, network down, etc.)', async () => {
    getCurrentUserId.mockRejectedValue(new Error('SecureStore unavailable'));

    await expect(bootstrapE2eeIdentity()).resolves.toBeUndefined();
  });
});
