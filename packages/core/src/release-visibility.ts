import type { ReleaseStatus } from './types/release';

/**
 * Публично ли виден релиз. Единый источник правды для витрины, публичного API и
 * SSR-страниц — иначе правило расползается копиями и одна из них отстаёт
 * (так черновики утекали через GET /api/v1/releases/[id] и страницу трека).
 *
 * PUBLISHED — виден всегда. SCHEDULED — сам релиз виден только после даты выхода
 * (до неё публична лишь страница обратного отсчёта, см. isCountdownVisible).
 * DRAFT/ARCHIVED — не виден никому, кроме владельца через dashboard-роуты.
 *
 * `now` инъектируется (не `new Date()` внутри) — чистая функция, тестируема.
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
