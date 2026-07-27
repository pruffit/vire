export interface JamPlaybackState {
  trackId: string;
  startedAtMs: number;
  paused: boolean;
  pausedPositionMs: number;
  version: number;
}

export const HARD_SEEK_MS = 2000;
export const SEEK_COOLDOWN_MS = 3000;
export const RATE_CORRECT_MIN_MS = 150;
export const CONVERGED_MS = 50;
export const RATE_DELTA = 0.03;

export function derivePositionMs(state: JamPlaybackState, serverNowMs: number): number {
  const raw = state.paused ? state.pausedPositionMs : serverNowMs - state.startedAtMs;
  return Math.max(0, raw);
}

export type DriftAction =
  | { kind: 'none' }
  | { kind: 'rate'; rate: number }
  | { kind: 'seek'; toMs: number };

export interface DriftDamperState {
  /** Элемент реально буферизует (readyState/waiting) — коррекция вслепую не читает актуальную позицию. */
  buffering: boolean;
  /** Мс с последнего жёсткого seek, null — если его ещё не было. */
  msSinceHardSeek: number | null;
}

export function decideDriftCorrection(
  expectedMs: number,
  actualMs: number,
  currentRate: number,
  damper: DriftDamperState,
): DriftAction {
  // Столл/свежий seek дают недостоверный actualMs — коррекция на нём петлит (столл → seek → новый столл).
  if (damper.buffering || (damper.msSinceHardSeek !== null && damper.msSinceHardSeek < SEEK_COOLDOWN_MS)) {
    return { kind: 'none' };
  }

  const drift = actualMs - expectedMs;
  const absDrift = Math.abs(drift);

  if (absDrift > HARD_SEEK_MS) {
    return { kind: 'seek', toMs: expectedMs };
  }

  if (absDrift >= RATE_CORRECT_MIN_MS) {
    return { kind: 'rate', rate: drift < 0 ? 1 + RATE_DELTA : 1 - RATE_DELTA };
  }

  if (absDrift < CONVERGED_MS) {
    return currentRate !== 1 ? { kind: 'rate', rate: 1 } : { kind: 'none' };
  }

  // Серая зона [CONVERGED_MS, RATE_CORRECT_MIN_MS): гистерезис — входим в
  // коррекцию на 150мс, выходим на 50мс, чтобы не дёргать rate туда-сюда.
  return currentRate !== 1 ? { kind: 'rate', rate: currentRate } : { kind: 'none' };
}

export function pickClockOffset(
  samples: Array<{ t0: number; tServer: number; t1: number }>,
): number {
  if (samples.length === 0) return 0;

  let best = samples[0]!;
  let bestRtt = best.t1 - best.t0;
  for (let i = 1; i < samples.length; i++) {
    const sample = samples[i]!;
    const rtt = sample.t1 - sample.t0;
    if (rtt < bestRtt) {
      best = sample;
      bestRtt = rtt;
    }
  }
  return best.tServer - (best.t0 + best.t1) / 2;
}
