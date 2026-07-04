// Мел-спектрограмма в стиле Essentia TensorflowInputMusiCNN — препроцессинг под
// discogs-effnet (и MusiCNN-совместимые модели вообще). Параметры зафиксированы
// под обучающий сетап моделей (essentia.upf.edu/models), менять нельзя:
// frameSize=512, hopSize=256, 96 мел-полос, sampleRate=16кГц, Slaney-мел-шкала,
// unit-area нормализация фильтров, лог-компрессия log10(1 + 10000*energy).
// Источник параметров — essentia src/algorithms/spectral/tensorflowinputmusicnn.cpp
// и melbands.h (warpingFormula=slaneyMel, weighting=linear, normalize=unit_tri,
// type=power). Это переиспользование СПЕЦИФИКАЦИИ, не кода Essentia — своя
// реализация на чистом TS (без WASM-зависимости essentia.js).

export const MEL_SAMPLE_RATE = 16000;
export const MEL_FRAME_SIZE = 512;
export const MEL_HOP_SIZE = 256;
export const MEL_NUM_BANDS = 96;
export const MEL_PATCH_SIZE = 128;
export const MEL_BATCH_SIZE = 64;

// ─── FFT (радикс-2, in-place, комплексный) ───────────────────────────────────

function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n <= 1) return;

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
        const vIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + len / 2] = uRe - vRe;
        im[i + k + len / 2] = uIm - vIm;
        const nextRe = curRe * wRe - curIm * wIm;
        const nextIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
        curIm = nextIm;
      }
    }
  }
}

// ─── Окно Ханна (симметричное, без нормировки энергии — Essentia normalized=false) ──

function hannWindow(size: number): Float64Array {
  const w = new Float64Array(size);
  for (let n = 0; n < size; n++) {
    w[n] = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (size - 1));
  }
  return w;
}

// ─── Мел-шкала Слейни (Auditory Toolbox), не HTK ─────────────────────────────

const F_SP = 200 / 3;
const MIN_LOG_HZ = 1000;
const MIN_LOG_MEL = MIN_LOG_HZ / F_SP;
const LOGSTEP = Math.log(6.4) / 27;

function hzToMelSlaney(hz: number): number {
  if (hz < MIN_LOG_HZ) return hz / F_SP;
  return MIN_LOG_MEL + Math.log(hz / MIN_LOG_HZ) / LOGSTEP;
}

function melToHzSlaney(mel: number): number {
  if (mel < MIN_LOG_MEL) return mel * F_SP;
  return MIN_LOG_HZ * Math.exp(LOGSTEP * (mel - MIN_LOG_MEL));
}

// ─── Треугольный мел-фильтрбанк (unit-area нормализация, как librosa norm='slaney') ─

interface MelFilterbank {
  // Для каждой полосы — [начальный бин, окончание) и веса на этом диапазоне.
  bands: Array<{ start: number; weights: Float64Array }>;
}

let cachedFilterbank: MelFilterbank | null = null;

function getMelFilterbank(): MelFilterbank {
  if (cachedFilterbank) return cachedFilterbank;

  const numFftBins = MEL_FRAME_SIZE / 2 + 1;
  const lowMel = hzToMelSlaney(0);
  const highMel = hzToMelSlaney(MEL_SAMPLE_RATE / 2);
  const melPoints = new Float64Array(MEL_NUM_BANDS + 2);
  for (let i = 0; i < melPoints.length; i++) {
    melPoints[i] = lowMel + ((highMel - lowMel) * i) / (MEL_NUM_BANDS + 1);
  }
  const hzPoints = Array.from(melPoints, melToHzSlaney);

  const bands: Array<{ start: number; weights: Float64Array }> = [];
  for (let b = 0; b < MEL_NUM_BANDS; b++) {
    const fLeft = hzPoints[b];
    const fCenter = hzPoints[b + 1];
    const fRight = hzPoints[b + 2];

    // unit-area (slaney) нормализация — высота треугольника обратна его ширине по Hz
    const norm = 2 / (fRight - fLeft);

    let start = -1;
    const weights: number[] = [];
    for (let k = 0; k < numFftBins; k++) {
      const freq = (k * MEL_SAMPLE_RATE) / MEL_FRAME_SIZE;
      let w = 0;
      if (freq >= fLeft && freq <= fCenter && fCenter > fLeft) {
        w = ((freq - fLeft) / (fCenter - fLeft)) * norm;
      } else if (freq > fCenter && freq <= fRight && fRight > fCenter) {
        w = ((fRight - freq) / (fRight - fCenter)) * norm;
      }
      if (w > 0) {
        if (start === -1) start = k;
        weights.push(w);
      } else if (start !== -1) {
        break; // треугольник закончился — веса дальше нулевые
      }
    }
    bands.push({ start: Math.max(start, 0), weights: new Float64Array(weights) });
  }

  cachedFilterbank = { bands };
  return cachedFilterbank;
}

// Каждые столько кадров отдаём event loop — без этого ~7500 кадров FFT512 на
// длинном треке считаются синхронно одним куском и блокируют весь Node-процесс
// воркера (в нём же крутятся play-events и другие очереди с concurrency 10).
const YIELD_EVERY_FRAMES = 256;

/**
 * Лог-мел-спектрограмма кадр за кадром: STFT (Hann, 512/256) → степенной
 * мел-фильтрбанк (96 полос, Slaney) → log10(1 + 10000*energy).
 * Первый кадр центрируется на сэмпле 0 (паддинг нулями спереди, как FrameCutter
 * у Essentia по умолчанию). Хвост короче кадра отбрасывается.
 * Async — периодически уступает event loop (см. YIELD_EVERY_FRAMES).
 */
export async function computeLogMelFrames(pcm: Float32Array): Promise<Float32Array[]> {
  const window = hannWindow(MEL_FRAME_SIZE);
  const filterbank = getMelFilterbank();
  const pad = MEL_FRAME_SIZE >> 1;

  const padded = new Float32Array(pad + pcm.length);
  padded.set(pcm, pad);

  const numFrames = Math.max(0, Math.floor((padded.length - MEL_FRAME_SIZE) / MEL_HOP_SIZE) + 1);
  const frames: Float32Array[] = [];

  const re = new Float64Array(MEL_FRAME_SIZE);
  const im = new Float64Array(MEL_FRAME_SIZE);
  const powerSpectrum = new Float64Array(MEL_FRAME_SIZE / 2 + 1);

  for (let f = 0; f < numFrames; f++) {
    const offset = f * MEL_HOP_SIZE;
    for (let n = 0; n < MEL_FRAME_SIZE; n++) {
      re[n] = padded[offset + n] * window[n];
      im[n] = 0;
    }
    fft(re, im);
    for (let k = 0; k < powerSpectrum.length; k++) {
      powerSpectrum[k] = re[k] * re[k] + im[k] * im[k];
    }

    const bands = new Float32Array(MEL_NUM_BANDS);
    for (let b = 0; b < MEL_NUM_BANDS; b++) {
      const { start, weights } = filterbank.bands[b];
      let energy = 0;
      for (let i = 0; i < weights.length; i++) energy += weights[i] * powerSpectrum[start + i];
      bands[b] = Math.log10(1 + 10000 * energy);
    }
    frames.push(bands);

    if (f % YIELD_EVERY_FRAMES === YIELD_EVERY_FRAMES - 1) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  }

  return frames;
}

export interface PatchBatch {
  /** Плоский Float32Array [numPatches, MEL_PATCH_SIZE, MEL_NUM_BANDS]. */
  data: Float32Array;
  numPatches: number;
}

/**
 * Режет фреймы на патчи по MEL_PATCH_SIZE без перекрытия (упрощение относительно
 * Essentia patchHopSize=62 — для «подсказки жанра» точное перекрытие не критично)
 * и группирует патчи в батчи по MEL_BATCH_SIZE — так инференс одного длинного
 * трека не выделяет один гигантский тензор целиком (RAM-бюджет VPS 1ГБ).
 * Модель discogs-effnet-bsdynamic поддерживает произвольный batch size, поэтому
 * последний батч просто короче — паддинг не нужен.
 */
export function chunkIntoPatchBatches(frames: Float32Array[]): PatchBatch[] {
  const patches: Float32Array[] = [];
  for (let i = 0; i + MEL_PATCH_SIZE <= frames.length; i += MEL_PATCH_SIZE) {
    const patch = new Float32Array(MEL_PATCH_SIZE * MEL_NUM_BANDS);
    for (let t = 0; t < MEL_PATCH_SIZE; t++) patch.set(frames[i + t], t * MEL_NUM_BANDS);
    patches.push(patch);
  }
  if (patches.length === 0) return [];

  const result: PatchBatch[] = [];
  for (let i = 0; i < patches.length; i += MEL_BATCH_SIZE) {
    const slice = patches.slice(i, i + MEL_BATCH_SIZE);
    const data = new Float32Array(slice.length * MEL_PATCH_SIZE * MEL_NUM_BANDS);
    for (let p = 0; p < slice.length; p++) data.set(slice[p], p * MEL_PATCH_SIZE * MEL_NUM_BANDS);
    result.push({ data, numPatches: slice.length });
  }
  return result;
}
