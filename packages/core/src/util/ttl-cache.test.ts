import { describe, it, expect, vi } from 'vitest';
import { createTtlCache } from './ttl-cache';

describe('createTtlCache', () => {
  it('reuses a cached value within TTL without calling load again', async () => {
    const cache = createTtlCache<string, number>({ ttlMs: 1000, maxSize: 10 });
    const load = vi.fn().mockResolvedValue(42);

    const first = await cache.get('a', load, 0);
    const second = await cache.get('a', load, 500);

    expect(first).toBe(42);
    expect(second).toBe(42);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('reloads once the TTL has expired', async () => {
    const cache = createTtlCache<string, number>({ ttlMs: 1000, maxSize: 10 });
    const load = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);

    const first = await cache.get('a', load, 0);
    const second = await cache.get('a', load, 1001);

    expect(first).toBe(1);
    expect(second).toBe(2);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('evicts expired entries first when over capacity', async () => {
    const cache = createTtlCache<string, number>({ ttlMs: 1000, maxSize: 2 });
    const load = vi.fn().mockResolvedValue(1);

    await cache.get('expired', load, 0);
    await cache.get('fresh', load, 1500);
    // 'expired' TTL (0..1000) already elapsed by t=1500; adding a third key
    // must evict it first rather than evicting 'fresh'.
    await cache.get('new', load, 1600);

    const freshLoad = vi.fn().mockResolvedValue(99);
    const expiredReload = vi.fn().mockResolvedValue(99);

    await cache.get('fresh', freshLoad, 1700);
    await cache.get('expired', expiredReload, 1700);

    expect(freshLoad).not.toHaveBeenCalled();
    expect(expiredReload).toHaveBeenCalledTimes(1);
  });

  it('evicts the oldest entry when full and nothing has expired', async () => {
    const cache = createTtlCache<string, number>({ ttlMs: 100_000, maxSize: 2 });
    const load = vi.fn().mockResolvedValue(1);

    await cache.get('oldest', load, 0);
    await cache.get('newer', load, 10);
    // capacity 2 reached; adding a third key must evict 'oldest', not 'newer'.
    await cache.get('newest', load, 20);

    const newerReload = vi.fn().mockResolvedValue(2);
    const oldestReload = vi.fn().mockResolvedValue(2);

    await cache.get('newer', newerReload, 30);
    await cache.get('oldest', oldestReload, 30);

    expect(newerReload).not.toHaveBeenCalled();
    expect(oldestReload).toHaveBeenCalledTimes(1);
  });

  it('clear() empties the cache', async () => {
    const cache = createTtlCache<string, number>({ ttlMs: 1000, maxSize: 10 });
    const load = vi.fn().mockResolvedValue(1);

    await cache.get('a', load, 0);
    cache.clear();
    await cache.get('a', load, 1);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('defaults now to Date.now when omitted', async () => {
    const cache = createTtlCache<string, number>({ ttlMs: 1000, maxSize: 10 });
    const value = await cache.get('a', () => Promise.resolve(7));
    expect(value).toBe(7);
  });
});
