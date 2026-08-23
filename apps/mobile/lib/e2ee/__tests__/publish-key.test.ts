import { describe, expect, it, vi, beforeEach } from 'vitest';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../../api-client', () => ({ apiRequest: request }));

import { publishIdentityKey } from '../publish-key';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('e2ee/publish-key', () => {
  it('POSTs the public key and returns true on success', async () => {
    request.mockResolvedValue({ ok: true, data: { ok: true } });

    const result = await publishIdentityKey('pubkey-a');

    expect(result).toBe(true);
    expect(request).toHaveBeenCalledWith(
      '/api/v1/keys',
      expect.objectContaining({ method: 'POST', body: { ikPub: 'pubkey-a' } }),
    );
  });

  it('is idempotent for the same key — does not re-POST on a second call', async () => {
    request.mockResolvedValue({ ok: true, data: { ok: true } });

    await publishIdentityKey('pubkey-b');
    await publishIdentityKey('pubkey-b');

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('a failed publish is not cached — a later call retries', async () => {
    request.mockResolvedValueOnce({ ok: false, error: { status: 500, message: 'boom' } });
    request.mockResolvedValueOnce({ ok: true, data: { ok: true } });

    const first = await publishIdentityKey('pubkey-c');
    const second = await publishIdentityKey('pubkey-c');

    expect(first).toBe(false);
    expect(second).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('a different key is published independently (dedup keyed by value, not global)', async () => {
    request.mockResolvedValue({ ok: true, data: { ok: true } });

    await publishIdentityKey('pubkey-d1');
    await publishIdentityKey('pubkey-d2');

    expect(request).toHaveBeenCalledTimes(2);
  });
});
