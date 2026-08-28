import { describe, it, expect } from 'vitest';
import { createStageTimer, jobDurationMs } from './timing.js';

/** Инъектируемые часы: отдают заданную последовательность отметок.
 *  Таймер зовёт часы дважды на этап — начало и конец. */
function fakeClock(ticks: number[]) {
  let i = 0;
  return () => ticks[i++] ?? 0;
}

describe('createStageTimer', () => {
  it('пишет этапы в порядке выполнения', async () => {
    const timer = createStageTimer(fakeClock([0, 100, 100, 500]));
    await timer.run('download', async () => 'a');
    await timer.run('analyze', async () => 'b');

    expect(timer.summary()).toBe('download=100ms analyze=400ms');
  });

  it('возвращает значение этапа без изменений', async () => {
    const timer = createStageTimer();
    await expect(timer.run('stage', async () => 42)).resolves.toBe(42);
  });

  it('сумма этапов — это totalMs', async () => {
    const timer = createStageTimer(fakeClock([0, 100, 100, 500]));
    await timer.run('a', async () => undefined);
    await timer.run('b', async () => undefined);

    expect(timer.totalMs()).toBe(500);
  });

  it('этап записан даже если упал: иначе разбивка теряется ровно там, где нужнее', async () => {
    const timer = createStageTimer(fakeClock([0, 250]));

    await expect(timer.run('boom', async () => { throw new Error('fail'); })).rejects.toThrow('fail');
    expect(timer.summary()).toBe('boom=250ms');
  });

  it('без этапов — пустая сводка, не падает', () => {
    const timer = createStageTimer();
    expect(timer.summary()).toBe('');
    expect(timer.totalMs()).toBe(0);
  });
});

describe('jobDurationMs', () => {
  it('считает разницу отметок BullMQ', () => {
    expect(jobDurationMs({ processedOn: 1000, finishedOn: 3500 })).toBe(2500);
  });

  it('нет отметок — null, а не ноль (ноль читался бы как мгновенный джоб)', () => {
    expect(jobDurationMs({ processedOn: 1000, finishedOn: null })).toBeNull();
    expect(jobDurationMs({ processedOn: null, finishedOn: 3500 })).toBeNull();
    expect(jobDurationMs(undefined)).toBeNull();
  });
});
