// скип трека, предложенного волной, — сильный сигнал о плохой рекомендации;
// скип собственного выбора слушателя говорит о треке меньше
export const PLAY_SOURCE_QUALITY_WEIGHTS: Readonly<Record<string, number>> = {
  wave: 1.0,
  playlist: 0.6,
  liked: 0.6,
  purchased: 0.6,
};

export const DEFAULT_SOURCE_QUALITY_WEIGHT = 0.8;

export function sourceQualityWeight(source: string): number {
  return PLAY_SOURCE_QUALITY_WEIGHTS[source] ?? DEFAULT_SOURCE_QUALITY_WEIGHT;
}

export const WAVE_SKIP_PENALTY = 0.4;
export const WAVE_SKIP_COMPLETION_THRESHOLD = 0.3;
export const WAVE_SKIP_WINDOW_DAYS = 30;
