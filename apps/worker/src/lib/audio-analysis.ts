import './ffmpeg-config.js'; // side-effect: гарантирует путь к ffmpeg до декода (не зависим от порядка импортов)
import ffmpeg from 'fluent-ffmpeg';

export interface AudioFeatures {
  bpm: number | null;
  musicalKey: string | null;
}

const SR = 22050; // sample rate for analysis (Hz)

// Decode audio to mono float32 PCM at заданной частоте (первые maxSec секунд).
// Общий декодер поверх fluent-ffmpeg — переиспользуется классификатором жанра
// (там нужно 16кГц под discogs-effnet, здесь — 22050 под BPM/key).
export function decodeMonoPcm(
  inputPath: string,
  sampleRate: number,
  maxSec: number,
): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const proc = ffmpeg(inputPath)
      .audioChannels(1)
      .audioFrequency(sampleRate)
      .duration(maxSec)
      .format('f32le');
    proc.on('error', reject);
    proc.on('end', () => {
      const buf = Buffer.concat(chunks);
      resolve(new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4)));
    });
    const stream = proc.pipe();
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  });
}

function decodeMono(inputPath: string, maxSec = 180): Promise<Float32Array> {
  return decodeMonoPcm(inputPath, SR, maxSec);
}

// ─── BPM detection (energy onset + autocorrelation) ──────────────────────────

const WIN = 512; // hop size ~23ms @ SR
const FPS = SR / WIN; // frames per second ≈ 43

function corrAt(signal: Float32Array, lag: number): number {
  let c = 0;
  for (let i = 0; i < signal.length - lag; i++) c += signal[i] * signal[i + lag];
  return c;
}

// Порог для октавной коррекции: удвоенный темп предпочитаем, только если его
// корреляция не сильно уступает лучшей (эмпирически подобрано на бэкбит-кейсах).
const OCTAVE_CORRECTION_RATIO = 0.7;

export function detectBPM(pcm: Float32Array): number | null {
  const n = Math.floor(pcm.length / WIN);
  if (n < 40) return null;

  // Short-time energy per window
  const energy = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let e = 0;
    const off = i * WIN;
    for (let j = 0; j < WIN; j++) { const s = pcm[off + j]; e += s * s; }
    energy[i] = e;
  }

  // Half-wave-rectified first-order difference → onset strength
  const onset = new Float32Array(n);
  for (let i = 1; i < n; i++) onset[i] = Math.max(0, energy[i] - energy[i - 1]);

  // Autocorrelation search in BPM range 60–200
  const lagMin = Math.max(2, Math.round(FPS * 60 / 200));
  const lagMax = Math.round(FPS * 60 / 60);
  const numLags = lagMax - lagMin + 1;

  const corrs = new Float32Array(numLags);
  for (let i = 0; i < numLags; i++) corrs[i] = corrAt(onset, lagMin + i);

  let bestIdx = 0;
  for (let i = 1; i < numLags; i++) if (corrs[i] > corrs[bestIdx]) bestIdx = i;
  // Нулевая (или отрицательная) автокорреляция — сигнал без периодичности (тишина/шум).
  if (corrs[bestIdx] <= 0) return null;

  // Октавная коррекция: сильный бэкбит (акцент на 2/4) даёт максимум автокорреляции
  // на удвоенном периоде — детектор берёт половинный темп. Проверяем кандидата
  // на удвоенном BPM (вдвое короче лаг); пик от него может съехать на соседний бин,
  // поэтому берём максимум в окне ±1 вокруг ожидаемой позиции.
  const halfLag = Math.round((lagMin + bestIdx) / 2);
  if (halfLag >= lagMin) {
    let halfIdx = halfLag - lagMin;
    for (const d of [-1, 1]) {
      const cand = halfIdx + d;
      if (cand >= 0 && cand < numLags && corrs[cand] > corrs[halfIdx]) halfIdx = cand;
    }
    if (corrs[halfIdx] >= OCTAVE_CORRECTION_RATIO * corrs[bestIdx]) bestIdx = halfIdx;
  }

  const y0 = bestIdx > 0 ? corrs[bestIdx - 1] : corrs[bestIdx];
  const y1 = corrs[bestIdx];
  const y2 = bestIdx < numLags - 1 ? corrs[bestIdx + 1] : corrs[bestIdx];

  // Parabolic interpolation for sub-frame accuracy
  const denom = 2 * y1 - y0 - y2;
  const lagF = denom > 0 ? (lagMin + bestIdx) + 0.5 * (y0 - y2) / denom : lagMin + bestIdx;

  const bpm = Math.round(FPS * 60 / lagF);
  return bpm >= 60 && bpm <= 200 ? bpm : null;
}

// ─── Key detection (Goertzel chroma + Krumhansl-Schmuckler) ──────────────────

const FRAME = 4096; // ~185ms per frame @ SR
const MIDI_LO = 48; // C3 = 130 Hz
const MIDI_HI = 107; // B7 = 3951 Hz  (all < SR/2 = 11025 Hz)

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

// Krumhansl-Schmuckler profiles (Temperley 1999)
const KS_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KS_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function midiFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Goertzel algorithm: energy of signal at target frequency (non-integer bin supported).
function goertzel(pcm: Float32Array, offset: number, freq: number): number {
  const k = (FRAME * freq) / SR;
  const coeff = 2 * Math.cos((2 * Math.PI * k) / FRAME);
  let s1 = 0, s2 = 0;
  for (let i = 0; i < FRAME; i++) {
    const s0 = coeff * s1 - s2 + pcm[offset + i];
    s2 = s1; s1 = s0;
  }
  return s1 * s1 + s2 * s2 - coeff * s1 * s2;
}

function detectKey(pcm: Float32Array): string | null {
  const numFrames = Math.floor(pcm.length / FRAME);
  if (numFrames < 2) return null;

  // Accumulate chroma energy over all frames
  const chroma = new Float32Array(12);
  for (let frame = 0; frame < numFrames; frame++) {
    const offset = frame * FRAME;
    for (let pc = 0; pc < 12; pc++) {
      // Sum energy across octaves for this pitch class
      for (let midi = MIDI_LO + pc; midi <= MIDI_HI; midi += 12) {
        chroma[pc] += goertzel(pcm, offset, midiFreq(midi));
      }
    }
  }

  // Normalize to [0, 1]
  let maxC = 0;
  for (let i = 0; i < 12; i++) if (chroma[i] > maxC) maxC = chroma[i];
  if (maxC === 0) return null;
  for (let i = 0; i < 12; i++) chroma[i] /= maxC;

  // Pearson correlation with all 24 key profiles
  let bestScore = -Infinity;
  let bestRoot = 0;
  let bestMajor = true;

  for (let root = 0; root < 12; root++) {
    const maj = pearsonCorr(chroma, KS_MAJOR, root);
    const min = pearsonCorr(chroma, KS_MINOR, root);
    if (maj > bestScore) { bestScore = maj; bestRoot = root; bestMajor = true; }
    if (min > bestScore) { bestScore = min; bestRoot = root; bestMajor = false; }
  }

  return `${NOTE_NAMES[bestRoot]} ${bestMajor ? 'major' : 'minor'}`;
}

// Pearson r between chroma vector and key profile rotated by `shift` semitones.
function pearsonCorr(chroma: Float32Array, profile: readonly number[], shift: number): number {
  const n = 12;
  let sA = 0, sB = 0, sAB = 0, sA2 = 0, sB2 = 0;
  for (let i = 0; i < n; i++) {
    const a = chroma[i];
    const b = profile[(i + n - shift) % n];
    sA += a; sB += b; sAB += a * b; sA2 += a * a; sB2 += b * b;
  }
  const num = n * sAB - sA * sB;
  const den = Math.sqrt((n * sA2 - sA * sA) * (n * sB2 - sB * sB));
  return den === 0 ? 0 : num / den;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Автоопределение BPM и тональности из аудио-файла.
 * Использует fluent-ffmpeg для декодирования, без внешних DSP-зависимостей.
 * Никогда не бросает — при ошибке возвращает null.
 */
export async function analyzeAudioFeatures(
  filePath: string,
  opts: { bpm: boolean; key: boolean },
): Promise<AudioFeatures> {
  if (!opts.bpm && !opts.key) return { bpm: null, musicalKey: null };
  try {
    const pcm = await decodeMono(filePath);
    return {
      bpm: opts.bpm ? detectBPM(pcm) : null,
      musicalKey: opts.key ? detectKey(pcm) : null,
    };
  } catch (e) {
    console.error('[audio-analysis]', e);
    return { bpm: null, musicalKey: null };
  }
}
