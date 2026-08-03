import type { JamQueueSource } from './jam';

/** Источники, из которых реально можно проиграть трек (embed-плеер или локальный файл). */
export type PlayableExternalSource = Extract<JamQueueSource, 'YOUTUBE' | 'SOUNDCLOUD' | 'AUDIUS' | 'LOCAL'>;

export interface ExternalTrackRef {
  source: PlayableExternalSource;
  externalId: string;
  /** LOCAL — файл лежит только в памяти браузера-колонки, ссылки нет. */
  externalUrl: string | null;
  title: string;
  artistName: string;
  coverUrl: string | null;
  durationSec: number | null;
}

/** Кандидат из бесплатного метаиндекса (iTunes/Deezer) — ещё не играбельный, только для показа/дальнейшего резолва. */
export interface MetadataHint {
  title: string;
  artistName: string;
  coverUrl: string | null;
  durationSec: number | null;
}

export type TrackCandidate =
  | { kind: 'VIRE'; trackId: string; title: string; artistName: string; coverUrl: string | null }
  | { kind: 'EXTERNAL'; ref: ExternalTrackRef }
  | { kind: 'HINT'; hint: MetadataHint };
