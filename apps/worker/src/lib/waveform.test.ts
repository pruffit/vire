import { describe, it, expect } from 'vitest';
import { peaksFromPcm } from './waveform.js';

/** Собрать PCM-буфер (16-bit LE) из массива сэмплов. */
function pcm(samples: number[]): Buffer {
  const buf = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => buf.writeInt16LE(s, i * 2));
  return buf;
}

describe('peaksFromPcm', () => {
  it('returns exactly numPeaks values', () => {
    const peaks = peaksFromPcm(pcm(new Array(1000).fill(0)), 50);
    expect(peaks).toHaveLength(50);
  });

  it('normalises the peak amplitude into [0, 1]', () => {
    const peaks = peaksFromPcm(pcm([32767, -32768, 0, 100]), 1);
    // макс по модулю = 32768/32768 = 1
    expect(peaks[0]).toBe(1);
  });

  it('takes the max within each bucket and uses absolute value', () => {
    // два бакета по два сэмпла: [−16384, 0] и [0, 8192]
    const peaks = peaksFromPcm(pcm([-16384, 0, 0, 8192]), 2);
    expect(peaks[0]).toBeCloseTo(0.5, 3); // 16384/32768
    expect(peaks[1]).toBeCloseTo(0.25, 3); // 8192/32768
  });

  it('returns all zeros for silence', () => {
    const peaks = peaksFromPcm(pcm(new Array(400).fill(0)), 10);
    expect(peaks.every((p) => p === 0)).toBe(true);
  });

  it('does not crash when there are fewer samples than peaks', () => {
    const peaks = peaksFromPcm(pcm([32767, 0, 0]), 200);
    expect(peaks).toHaveLength(200);
    expect(peaks[0]).toBe(1);
  });

  it('rounds to 4 decimal places', () => {
    const peaks = peaksFromPcm(pcm([12345]), 1);
    expect(peaks[0]).toBe(Number((12345 / 32768).toFixed(4)));
  });
});
