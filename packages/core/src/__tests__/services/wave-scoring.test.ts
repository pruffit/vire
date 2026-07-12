import { describe, expect, it } from 'vitest';
import {
  sourceQualityWeight,
  PLAY_SOURCE_QUALITY_WEIGHTS,
  DEFAULT_SOURCE_QUALITY_WEIGHT,
  WAVE_SKIP_PENALTY,
  WAVE_SKIP_COMPLETION_THRESHOLD,
  WAVE_SKIP_WINDOW_DAYS,
} from '../../services/wave-scoring';

describe('sourceQualityWeight', () => {
  it('скип рекомендации волны — сильнейший сигнал', () => {
    expect(sourceQualityWeight('wave')).toBe(1.0);
  });
  it.each(['playlist', 'liked', 'purchased'])('осознанный выбор (%s) — слабый сигнал 0.6', (s) => {
    expect(sourceQualityWeight(s)).toBe(0.6);
  });
  it.each(['release', 'artist', 'home', 'feed', 'search', 'direct', 'unknown-future'])(
    'остальные и неизвестные (%s) — дефолт 0.8',
    (s) => {
      expect(sourceQualityWeight(s)).toBe(DEFAULT_SOURCE_QUALITY_WEIGHT);
    },
  );
  it('веса в диапазоне (0, 1]', () => {
    for (const w of Object.values(PLAY_SOURCE_QUALITY_WEIGHTS)) {
      expect(w).toBeGreaterThan(0);
      expect(w).toBeLessThanOrEqual(1);
    }
  });
});

describe('константы waveSkipPenalty', () => {
  it('значения зафиксированы', () => {
    expect(WAVE_SKIP_PENALTY).toBe(0.4);
    expect(WAVE_SKIP_COMPLETION_THRESHOLD).toBe(0.3);
    expect(WAVE_SKIP_WINDOW_DAYS).toBe(30);
  });
});
