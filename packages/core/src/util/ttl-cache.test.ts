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

  it('single-flights concurrent loads for the same key', async () => {
    const cache = createTtlCache<string, number>({ ttlMs: 1000, maxSize: 10 });
    let resolveLoad: (value: number) => void = () => {};
    const load = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          resolveLoad = resolve;
        }),
    );

    const first = cache.get('a', load, 0);
    const second = cache.get('a', load, 0);

    resolveLoad(42);
    const [firstValue, secondValue] = await Promise.all([first, second]);

    expect(firstValue).toBe(42);
    expect(secondValue).toBe(42);
    expect(load).toHaveBeenCalledTimes(1);

    // resolved value is cached — a subsequent get before TTL expiry does not call load again
    const cachedLoad = vi.fn().mockResolvedValue(99);
    const third = await cache.get('a', cachedLoad, 100);
    expect(third).toBe(42);
    expect(cachedLoad).not.toHaveBeenCalled();
  });

  it('does not cache a rejected load, so a later get() retries', async () => {
    const cache = createTtlCache<string, number>({ ttlMs: 1000, maxSize: 10 });
    const failingLoad = vi.fn().mockRejectedValue(new Error('boom'));

    const firstAttempt = cache.get('a', failingLoad, 0);
    const secondAttempt = cache.get('a', failingLoad, 0);

    await expect(firstAttempt).rejects.toThrow('boom');
    await expect(secondAttempt).rejects.toThrow('boom');
    expect(failingLoad).toHaveBeenCalledTimes(1);

    const retryLoad = vi.fn().mockResolvedValue(7);
    const value = await cache.get('a', retryLoad, 1);
    expect(value).toBe(7);
    expect(retryLoad).toHaveBeenCalledTimes(1);
  });

  it('returns a rejected promise (not a sync throw) when load throws synchronously', async () => {
    const cache = createTtlCache<string, number>({ ttlMs: 1000, maxSize: 10 });
    const throwingLoad = () => {
      throw new Error('sync boom');
    };

    // Must not throw synchronously — the contract is Promise<V>.
    const result = cache.get('a', throwingLoad, 0);
    await expect(result).rejects.toThrow('sync boom');

    // in-flight not poisoned: a later valid get() succeeds.
    const value = await cache.get('a', () => Promise.resolve(5), 1);
    expect(value).toBe(5);
  });

  it('clear() drops in-flight state so a concurrent get() re-invokes load', async () => {
    const cache = createTtlCache<string, number>({ ttlMs: 1000, maxSize: 10 });
    let resolveFirst: (value: number) => void = () => {};
    const firstLoad = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          resolveFirst = resolve;
        }),
    );

    const pending = cache.get('a', firstLoad, 0);
    cache.clear();

    // If clear() hadn't dropped the in-flight entry, this would return the
    // still-unresolved `pending` promise instead of triggering a fresh load.
    const secondLoad = vi.fn().mockResolvedValue(2);
    const secondValue = await cache.get('a', secondLoad, 0);

    expect(secondValue).toBe(2);
    expect(secondLoad).toHaveBeenCalledTimes(1);

    resolveFirst(1);
    await pending;
  });
});
