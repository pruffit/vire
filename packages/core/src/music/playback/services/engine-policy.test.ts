import { describe, it, expect } from 'vitest';
import {
  shouldGiveUpOnWave,
  shouldStopLocalRetries,
  shouldPrefetchNext,
  shouldRunTick,
  clampRestoredQueueIndex,
  playedIdsWindow,
  WAVE_ERROR_LIMIT,
  LOCAL_MISS_LIMIT,
  PREFETCH_LEAD_SEC,
  TICK_INTERVAL_MS,
  PLAYED_IDS_WINDOW,
} from './engine-policy';

describe('shouldGiveUpOnWave', () => {
  it('порог − 1: ещё не сдаётся', () => {
    expect(shouldGiveUpOnWave(WAVE_ERROR_LIMIT - 1)).toBe(false);
  });

  it('ровно порог: сдаётся', () => {
    expect(shouldGiveUpOnWave(WAVE_ERROR_LIMIT)).toBe(true);
  });

  it('порог + 1: сдаётся', () => {
    expect(shouldGiveUpOnWave(WAVE_ERROR_LIMIT + 1)).toBe(true);
  });
});

describe('shouldStopLocalRetries', () => {
  it('порог − 1: ещё пробует', () => {
    expect(shouldStopLocalRetries(LOCAL_MISS_LIMIT - 1)).toBe(false);
  });

  it('ровно порог: останавливается', () => {
    expect(shouldStopLocalRetries(LOCAL_MISS_LIMIT)).toBe(true);
  });

  it('порог + 1: останавливается', () => {
    expect(shouldStopLocalRetries(LOCAL_MISS_LIMIT + 1)).toBe(true);
  });
});

describe('shouldPrefetchNext', () => {
  const duration = 100;

  it('до конца больше PREFETCH_LEAD_SEC + 1: рано', () => {
    expect(shouldPrefetchNext(duration - (PREFETCH_LEAD_SEC + 1), duration)).toBe(false);
  });

  it('до конца ровно PREFETCH_LEAD_SEC: ещё рано (порог не включён)', () => {
    expect(shouldPrefetchNext(duration - PREFETCH_LEAD_SEC, duration)).toBe(false);
  });

  it('до конца PREFETCH_LEAD_SEC − 1: пора префетчить', () => {
    expect(shouldPrefetchNext(duration - (PREFETCH_LEAD_SEC - 1), duration)).toBe(true);
  });
});

describe('shouldRunTick', () => {
  it('интервал − 1: рано', () => {
    expect(shouldRunTick(TICK_INTERVAL_MS - 1, 0)).toBe(false);
  });

  it('ровно интервал: пора', () => {
    expect(shouldRunTick(TICK_INTERVAL_MS, 0)).toBe(true);
  });

  it('интервал + 1: пора', () => {
    expect(shouldRunTick(TICK_INTERVAL_MS + 1, 0)).toBe(true);
  });
});

describe('clampRestoredQueueIndex', () => {
  it('индекс в границах — не меняется', () => {
    expect(clampRestoredQueueIndex(2, 5)).toBe(2);
  });

  it('индекс = queueLength − 1 (последний валидный) — не меняется', () => {
    expect(clampRestoredQueueIndex(4, 5)).toBe(4);
  });

  it('индекс = queueLength (первый невалидный) — падает на 0', () => {
    expect(clampRestoredQueueIndex(5, 5)).toBe(0);
  });

  it('индекс = -1 (не найден) — падает на 0', () => {
    expect(clampRestoredQueueIndex(-1, 5)).toBe(0);
  });
});

describe('playedIdsWindow', () => {
  function ids(n: number): string[] {
    return Array.from({ length: n }, (_, i) => `id-${i}`);
  }

  it('окно − 1 элементов — возвращается целиком', () => {
    const input = ids(PLAYED_IDS_WINDOW - 1);
    expect(playedIdsWindow(input)).toEqual(input);
  });

  it('ровно окно элементов — возвращается целиком', () => {
    const input = ids(PLAYED_IDS_WINDOW);
    expect(playedIdsWindow(input)).toEqual(input);
  });

  it('окно + 1 элементов — режется до последних PLAYED_IDS_WINDOW', () => {
    const input = ids(PLAYED_IDS_WINDOW + 1);
    const result = playedIdsWindow(input);
    expect(result).toHaveLength(PLAYED_IDS_WINDOW);
    expect(result[0]).toBe('id-1');
    expect(result[result.length - 1]).toBe(`id-${PLAYED_IDS_WINDOW}`);
  });
});
