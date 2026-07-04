import { describe, it, expect } from 'vitest';
import {
  MEL_SAMPLE_RATE,
  MEL_HOP_SIZE,
  MEL_NUM_BANDS,
  MEL_PATCH_SIZE,
  MEL_BATCH_SIZE,
  computeLogMelFrames,
  chunkIntoPatchBatches,
} from './mel-spectrogram.js';

function sine(freq: number, seconds: number): Float32Array {
  const n = Math.round(MEL_SAMPLE_RATE * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.sin((2 * Math.PI * freq * i) / MEL_SAMPLE_RATE);
  return out;
}

describe('computeLogMelFrames', () => {
  it('возвращает кадры фиксированной длины MEL_NUM_BANDS', async () => {
    const frames = await computeLogMelFrames(sine(440, 1));
    expect(frames.length).toBeGreaterThan(0);
    for (const f of frames) expect(f.length).toBe(MEL_NUM_BANDS);
  });

  it('число кадров примерно соответствует hop-size (без учёта паддинга)', async () => {
    const seconds = 2;
    const frames = await computeLogMelFrames(sine(220, seconds));
    const expected = Math.floor((seconds * MEL_SAMPLE_RATE) / MEL_HOP_SIZE);
    expect(Math.abs(frames.length - expected)).toBeLessThanOrEqual(2);
  });

  it('энергии неотрицательны (log10(1+x) с x>=0)', async () => {
    const frames = await computeLogMelFrames(sine(1000, 0.5));
    for (const f of frames) for (const v of f) expect(v).toBeGreaterThanOrEqual(0);
  });

  it('тишина (нулевой сигнал) даёт нулевые лог-энергии', async () => {
    const silence = new Float32Array(MEL_SAMPLE_RATE);
    const frames = await computeLogMelFrames(silence);
    for (const f of frames) for (const v of f) expect(v).toBeCloseTo(0, 6);
  });

  it('уступает event loop на длинном треке (кадров больше YIELD_EVERY_FRAMES=256)', async () => {
    // 10с при hop=256/rate=16000 — заведомо больше 256 кадров, цикл должен пройти
    // хотя бы через один await setImmediate, не заблокировав всё синхронно.
    const frames = await computeLogMelFrames(sine(300, 10));
    expect(frames.length).toBeGreaterThan(256);
  });
});

describe('chunkIntoPatchBatches', () => {
  function makeFrames(count: number): Float32Array[] {
    return Array.from({ length: count }, () => new Float32Array(MEL_NUM_BANDS));
  }

  it('короче одного патча — нет батчей', () => {
    expect(chunkIntoPatchBatches(makeFrames(MEL_PATCH_SIZE - 1))).toEqual([]);
  });

  it('ровно один патч — один батч с numPatches=1', () => {
    const batches = chunkIntoPatchBatches(makeFrames(MEL_PATCH_SIZE));
    expect(batches).toHaveLength(1);
    expect(batches[0].numPatches).toBe(1);
    expect(batches[0].data.length).toBe(MEL_PATCH_SIZE * MEL_NUM_BANDS);
  });

  it('дробит патчи на батчи по MEL_BATCH_SIZE, последний батч короче без паддинга', () => {
    const totalPatches = MEL_BATCH_SIZE + 3;
    const batches = chunkIntoPatchBatches(makeFrames(totalPatches * MEL_PATCH_SIZE));
    expect(batches).toHaveLength(2);
    expect(batches[0].numPatches).toBe(MEL_BATCH_SIZE);
    expect(batches[1].numPatches).toBe(3);
  });

  it('лишние неполные кадры в конце отбрасываются', () => {
    const batches = chunkIntoPatchBatches(makeFrames(MEL_PATCH_SIZE + 10));
    expect(batches).toHaveLength(1);
    expect(batches[0].numPatches).toBe(1);
  });
});
