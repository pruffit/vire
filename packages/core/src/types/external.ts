import type { JamQueueSource } from './jam';

/** Источники, из которых реально можно проиграть трек (embed-плеер есть). */
export type PlayableExternalSource = Extract<JamQueueSource, 'YOUTUBE' | 'SOUNDCLOUD'>;

export interface ExternalTrackRef {
  source: PlayableExternalSource;
  externalId: string;
  externalUrl: string;
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
