export interface AudioFeatures {
  /** Общая громкость 0..1 (RMS по волне). */
  level: number;
  bass: number;
  mid: number;
  treble: number;
  /** Импульс на удар: 1 в момент онсета, дальше затухает к нулю. */
  beat: number;
  bpm: number | null;
}

export const SILENT_FEATURES: AudioFeatures = { level: 0, bass: 0, mid: 0, treble: 0, beat: 0, bpm: null };

/** Быстрее 240 ударов в минуту — уже не ритм, а дребезг спектра. */
const MIN_BEAT_GAP_SEC = 0.25;
const HISTORY_SEC = 1.4;
const MIN_BPM = 60;
const MAX_BPM = 190;
const BEAT_DECAY_PER_SEC = 3.4;

export function rms(timeDomain: Uint8Array): number {
  if (timeDomain.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < timeDomain.length; i++) {
    const v = (timeDomain[i]! - 128) / 128;
    sum += v * v;
  }
  return Math.min(1, Math.sqrt(sum / timeDomain.length) * 1.9);
}

/** Среднее по срезу спектра; границы — доли 0..1 от полосы, чтобы не зависеть от размера FFT. */
export function bandEnergy(freq: Uint8Array, fromRatio: number, toRatio: number): number {
  if (freq.length === 0) return 0;
  const from = Math.max(0, Math.floor(fromRatio * freq.length));
  const to = Math.min(freq.length, Math.ceil(toRatio * freq.length));
  if (to <= from) return 0;
  let sum = 0;
  for (let i = from; i < to; i++) sum += freq[i]!;
  return sum / (to - from) / 255;
}

export function decayBeat(previous: number, deltaSec: number): number {
  return Math.max(0, previous - deltaSec * BEAT_DECAY_PER_SEC);
}

interface Sample {
  energy: number;
  at: number;
}

export interface BeatTracker {
  /** Возвращает true, если на этом кадре случился удар. */
  push(energy: number, timeSec: number): boolean;
  bpm(): number | null;
}

/**
 * Онсет по локальному всплеску энергии баса: сравниваем кадр со скользящим средним за
 * последние 1.4с. Порог адаптивный (растёт с разбросом), иначе на плотном миксе детектор
 * срабатывает на каждый кадр, а на тихом — молчит.
 */
export function createBeatTracker(): BeatTracker {
  const history: Sample[] = [];
  const intervals: number[] = [];
  let lastBeatAt = -Infinity;

  return {
    push(energy, timeSec) {
      history.push({ energy, at: timeSec });
      while (history.length > 0 && timeSec - history[0]!.at > HISTORY_SEC) history.shift();
      if (history.length < 8) return false;

      let sum = 0;
      for (const s of history) sum += s.energy;
      const mean = sum / history.length;
      let varianceSum = 0;
      for (const s of history) varianceSum += (s.energy - mean) ** 2;
      const variance = varianceSum / history.length;
      const threshold = mean * (1.35 + variance * 12) + 0.012;

      if (energy < threshold || timeSec - lastBeatAt < MIN_BEAT_GAP_SEC) return false;

      if (lastBeatAt > -Infinity) {
        const gap = timeSec - lastBeatAt;
        if (gap <= 60 / MIN_BPM) {
          intervals.push(gap);
          if (intervals.length > 24) intervals.shift();
        } else {
          // Пауза длиннее самого медленного темпа — прежний счёт больше не про этот кусок.
          intervals.length = 0;
        }
      }
      lastBeatAt = timeSec;
      return true;
    },

    bpm() {
      if (intervals.length < 4) return null;
      const sorted = [...intervals].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)]!;
      if (median <= 0) return null;
      let bpm = 60 / median;
      while (bpm < MIN_BPM) bpm *= 2;
      while (bpm > MAX_BPM) bpm /= 2;
      return Math.round(bpm);
    },
  };
}
