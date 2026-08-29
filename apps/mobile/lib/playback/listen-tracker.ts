import type { PlaySource } from '@vire/api-contracts';

/**
 * Учёт фактически прослушанного времени — чистый, без сети и таймеров.
 *
 * Почему это отдельная сущность, а не `Date.now()` в двух местах: `durationPlayedSec`
 * уходит в аналитику платформы, и Волна делит его на длительность трека, получая качество
 * дослушивания (`packages/db/src/queries/wave.ts`). Завышенная длительность (например,
 * если засчитывать паузу) испортит рекомендации ВСЕЙ платформы, а не только мобильную
 * статистику. Поэтому копим только интервалы реального воспроизведения.
 */
export interface ListenSpan {
  trackId: string;
  source: PlaySource;
  startedAt: string;
  durationPlayedSec: number;
}

interface OpenSpan {
  trackId: string;
  source: PlaySource;
  /** Момент начала прослушивания, ISO — уходит в событие как есть. */
  startedAt: string;
  /** Накоплено до текущего отрезка, мс. */
  accumulatedMs: number;
  /** Когда пошёл текущий отрезок воспроизведения; null — сейчас пауза. */
  playingSinceMs: number | null;
}

export class ListenTracker {
  private span: OpenSpan | null = null;

  /** Начало прослушивания трека. Предыдущее, если было, обязан закрыть вызывающий. */
  start(trackId: string, source: PlaySource, nowMs: number): void {
    this.span = {
      trackId,
      source,
      startedAt: new Date(nowMs).toISOString(),
      accumulatedMs: 0,
      playingSinceMs: null,
    };
  }

  resume(nowMs: number): void {
    if (!this.span || this.span.playingSinceMs !== null) return;
    this.span.playingSinceMs = nowMs;
  }

  pause(nowMs: number): void {
    if (!this.span || this.span.playingSinceMs === null) return;
    this.span.accumulatedMs += Math.max(0, nowMs - this.span.playingSinceMs);
    this.span.playingSinceMs = null;
  }

  /**
   * Закрывает прослушивание и отдаёт событие. `null`, если слушали меньше секунды —
   * такие «прослушивания» это перелистывание, и засорять ими аналитику незачем.
   */
  finish(nowMs: number): ListenSpan | null {
    if (!this.span) return null;
    this.pause(nowMs);
    const { trackId, source, startedAt, accumulatedMs } = this.span;
    this.span = null;

    const durationPlayedSec = Math.floor(accumulatedMs / 1000);
    if (durationPlayedSec < 1) return null;
    return { trackId, source, startedAt, durationPlayedSec };
  }

  /**
   * Отдаёт накопленное, НЕ закрывая учёт: уход в фон — последняя точка, где можно
   * отчитаться (дальше систему вправе убить процесс), но музыка при этом продолжает
   * играть, и трек не закончился.
   *
   * Накопленное обнуляется, а отсчёт начинается заново — иначе следующий флаш посчитал бы
   * то же время второй раз и завысил бы качество дослушивания.
   */
  snapshot(nowMs: number): ListenSpan | null {
    if (!this.span) return null;

    const wasPlaying = this.span.playingSinceMs !== null;
    this.pause(nowMs);
    const { trackId, source, startedAt, accumulatedMs } = this.span;

    this.span.accumulatedMs = 0;
    this.span.startedAt = new Date(nowMs).toISOString();
    if (wasPlaying) this.span.playingSinceMs = nowMs;

    const durationPlayedSec = Math.floor(accumulatedMs / 1000);
    if (durationPlayedSec < 1) return null;
    return { trackId, source, startedAt, durationPlayedSec };
  }

  /** Идёт ли сейчас учёт (для тестов и диагностики). */
  get currentTrackId(): string | null {
    return this.span?.trackId ?? null;
  }
}
