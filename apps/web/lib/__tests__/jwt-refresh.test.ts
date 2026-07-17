import { describe, it, expect, vi } from 'vitest';
import {
  shouldRefreshRole,
  applyJwt,
  isNodeRuntime,
  JWT_ROLE_REFRESH_MS,
  type JwtDeps,
  type JwtLike,
  type RefreshedUser,
} from '../jwt-refresh';

const USER: RefreshedUser = { role: 'ADMIN', name: 'Neo', image: 'a.png' };

describe('shouldRefreshRole', () => {
  it('refreshes when syncedAt is missing', () => {
    expect(shouldRefreshRole({ id: 'u1' }, 1_000)).toBe(true);
  });

  it('does not refresh when fresh', () => {
    expect(shouldRefreshRole({ id: 'u1', syncedAt: 1_000 }, 1_000 + JWT_ROLE_REFRESH_MS - 1)).toBe(false);
  });

  it('does not refresh exactly at the TTL boundary (strict >)', () => {
    expect(shouldRefreshRole({ id: 'u1', syncedAt: 1_000 }, 1_000 + JWT_ROLE_REFRESH_MS)).toBe(false);
  });

  it('refreshes once past the TTL', () => {
    expect(shouldRefreshRole({ id: 'u1', syncedAt: 1_000 }, 1_000 + JWT_ROLE_REFRESH_MS + 1)).toBe(true);
  });
});

describe('isNodeRuntime', () => {
  it('true when EdgeRuntime is undefined', () => {
    expect(isNodeRuntime()).toBe(true);
  });

  it('false when EdgeRuntime is defined (edge middleware sandbox)', () => {
    (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime = 'edge-runtime';
    try {
      expect(isNodeRuntime()).toBe(false);
    } finally {
      delete (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime;
    }
  });
});

describe('applyJwt', () => {
  const NOW = 1_000_000;
  const deps = (over: Partial<JwtDeps> = {}): JwtDeps => ({
    now: NOW,
    isNode: true,
    loadUser: vi.fn().mockResolvedValue(USER),
    ...over,
  });

  it('fresh login writes id/role and stamps syncedAt', async () => {
    const token: JwtLike = {};
    await applyJwt(token, { id: 'u1', role: 'LISTENER' }, deps());
    expect(token).toEqual({ id: 'u1', role: 'LISTENER', syncedAt: NOW });
  });

  it('leaves an anonymous token (no id) untouched', async () => {
    const token: JwtLike = {};
    const d = deps();
    await applyJwt(token, undefined, d);
    expect(token).toEqual({});
    expect(d.loadUser).not.toHaveBeenCalled();
  });

  it('skips the DB and syncedAt outside Node runtime (edge)', async () => {
    const token: JwtLike = { id: 'u1', role: 'LISTENER' };
    const d = deps({ isNode: false });
    await applyJwt(token, undefined, d);
    expect(token).toEqual({ id: 'u1', role: 'LISTENER' });
    expect(d.loadUser).not.toHaveBeenCalled();
  });

  it('skips the DB while still within TTL', async () => {
    const token: JwtLike = { id: 'u1', role: 'LISTENER', syncedAt: NOW };
    const d = deps();
    await applyJwt(token, undefined, d);
    expect(token.role).toBe('LISTENER');
    expect(d.loadUser).not.toHaveBeenCalled();
  });

  it('refreshes role/name/image when due in Node', async () => {
    const token: JwtLike = { id: 'u1', role: 'LISTENER' };
    const d = deps();
    await applyJwt(token, undefined, d);
    expect(d.loadUser).toHaveBeenCalledWith('u1');
    expect(token).toMatchObject({ role: 'ADMIN', name: 'Neo', picture: 'a.png', syncedAt: NOW });
  });

  it('advances syncedAt even when the user is gone (no retry storm)', async () => {
    const token: JwtLike = { id: 'u1', role: 'ADMIN' };
    await applyJwt(token, undefined, deps({ loadUser: vi.fn().mockResolvedValue(null) }));
    expect(token.role).toBe('ADMIN');
    expect(token.syncedAt).toBe(NOW);
  });

  it('advances syncedAt when the DB throws, keeping the old role (no retry storm)', async () => {
    const token: JwtLike = { id: 'u1', role: 'ADMIN' };
    await applyJwt(token, undefined, deps({ loadUser: vi.fn().mockRejectedValue(new Error('db down')) }));
    expect(token.role).toBe('ADMIN');
    expect(token.syncedAt).toBe(NOW);
  });
});
