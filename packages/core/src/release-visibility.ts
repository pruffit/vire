import type { ReleaseStatus } from './types/release';

/**
 * Единый источник правды публичной видимости релиза (витрина, публичный API, SSR).
 * SCHEDULED виден только после даты выхода; до неё — только счётчик (isCountdownVisible).
 */
export function isReleasePubliclyVisible(
  release: { status: ReleaseStatus; releaseDate: Date | null },
  now: Date,
): boolean {
  if (release.status === 'PUBLISHED') return true;
  if (release.status !== 'SCHEDULED') return false;
  return release.releaseDate != null && release.releaseDate.getTime() <= now.getTime();
}

/** Экран обратного отсчёта: SCHEDULED с ещё не наступившей датой. */
export function isCountdownVisible(
  release: { status: ReleaseStatus; releaseDate: Date | null },
  now: Date,
): boolean {
  return (
    release.status === 'SCHEDULED' &&
    release.releaseDate != null &&
    release.releaseDate.getTime() > now.getTime()
  );
}
