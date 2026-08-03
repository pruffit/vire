import { describe, expect, it } from 'vitest';
import { bandEnergy, createBeatTracker, decayBeat, rms } from './features';

describe('rms', () => {
  it('тишина (все отсчёты в середине) даёт ноль', () => {
    expect(rms(new Uint8Array(64).fill(128))).toBe(0);
  });

  it('размах до краёв даёт максимум', () => {
    const wave = new Uint8Array(64);
    for (let i = 0; i < wave.length; i++) wave[i] = i % 2 === 0 ? 0 : 255;
    expect(rms(wave)).toBe(1);
  });

  it('пустой буфер не роняет', () => {
    expect(rms(new Uint8Array(0))).toBe(0);
  });
});

describe('bandEnergy', () => {
  it('считает среднее по своей доле полосы', () => {
    const freq = new Uint8Array([255, 255, 0, 0]);
    expect(bandEnergy(freq, 0, 0.5)).toBe(1);
    expect(bandEnergy(freq, 0.5, 1)).toBe(0);
  });

  it('пустой срез не делит на ноль', () => {
    expect(bandEnergy(new Uint8Array([10, 20]), 0.5, 0.5)).toBe(0);
  });
});

describe('decayBeat', () => {
  it('затухает со временем и не уходит ниже нуля', () => {
    expect(decayBeat(1, 0.1)).toBeCloseTo(0.66, 2);
    expect(decayBeat(0.1, 10)).toBe(0);
  });
});

describe('createBeatTracker', () => {
  /** Ровный низкий фон, поверх которого раз в `period` секунд приходит всплеск. */
  function feed(tracker: ReturnType<typeof createBeatTracker>, period: number, seconds: number): number[] {
    const hits: number[] = [];
    const step = 1 / 60;
    for (let t = 0; t < seconds; t += step) {
      const sinceBeat = t % period;
      const energy = sinceBeat < step ? 0.9 : 0.05;
      if (tracker.push(energy, t)) hits.push(t);
    }
    return hits;
  }

  it('на ровном сигнале ударов нет', () => {
    const tracker = createBeatTracker();
    let hits = 0;
    for (let t = 0; t < 3; t += 1 / 60) if (tracker.push(0.2, t)) hits++;
    expect(hits).toBe(0);
  });

  it('ловит регулярные всплески и считает по ним темп', () => {
    const tracker = createBeatTracker();
    const hits = feed(tracker, 0.5, 8);
    expect(hits.length).toBeGreaterThan(8);
    expect(tracker.bpm()).toBe(120);
  });

  it('темп не отдаётся, пока ударов слишком мало для вывода', () => {
    const tracker = createBeatTracker();
    feed(tracker, 0.5, 1.2);
    expect(tracker.bpm()).toBeNull();
  });

  it('удары чаще 240 в минуту отбрасываются как дребезг', () => {
    const tracker = createBeatTracker();
    const hits = feed(tracker, 0.1, 4);
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i]! - hits[i - 1]!).toBeGreaterThanOrEqual(0.25);
    }
  });
});
