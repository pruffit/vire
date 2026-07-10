import { describe, it, expect } from 'vitest';
import { createThrottleGate } from '../util/throttle-gate';

describe('createThrottleGate', () => {
  it('первый вызов проходит, повтор в окне — подавляется', () => {
    const gate = createThrottleGate({ ttlMs: 1000, maxSize: 100 });
    expect(gate.shouldPass('a', 0)).toBe(true);
    expect(gate.shouldPass('a', 500)).toBe(false);
    expect(gate.shouldPass('a', 999)).toBe(false);
  });

  it('после истечения TTL ключ снова проходит', () => {
    const gate = createThrottleGate({ ttlMs: 1000, maxSize: 100 });
    expect(gate.shouldPass('a', 0)).toBe(true);
    expect(gate.shouldPass('a', 1000)).toBe(true);
    expect(gate.shouldPass('a', 1500)).toBe(false);
  });

  it('разные ключи не мешают друг другу', () => {
    const gate = createThrottleGate({ ttlMs: 1000, maxSize: 100 });
    expect(gate.shouldPass('a', 0)).toBe(true);
    expect(gate.shouldPass('b', 0)).toBe(true);
  });

  it('размер не превышает maxSize на потоке уникальных ключей', () => {
    const gate = createThrottleGate({ ttlMs: 60_000, maxSize: 10 });
    for (let i = 0; i < 1000; i++) {
      expect(gate.shouldPass(`job-${i}-failed`, i)).toBe(true);
    }
    expect(gate.size()).toBeLessThanOrEqual(10);
  });

  it('протухшие записи вычищаются, не занимая потолок', () => {
    const gate = createThrottleGate({ ttlMs: 100, maxSize: 5 });
    for (let i = 0; i < 5; i++) gate.shouldPass(`old-${i}`, 0);
    expect(gate.size()).toBe(5);

    gate.shouldPass('fresh', 1000);
    expect(gate.size()).toBe(1);
  });

  it('вытеснение старого ключа снимает подавление (алерт повторится, но не потеряется)', () => {
    const gate = createThrottleGate({ ttlMs: 60_000, maxSize: 2 });
    gate.shouldPass('a', 0);
    gate.shouldPass('b', 1);
    gate.shouldPass('c', 2);
    expect(gate.shouldPass('a', 3)).toBe(true);
  });
});
