import type { TasteProfile } from './wave';

export type FeedItemKind = 'RELEASE' | 'POST' | 'UPCOMING';
export type FeedReason = 'follow' | 'taste' | 'fresh';

export interface FeedCandidate {
  kind: FeedItemKind;
  id: string;
  artistProfileId: string;
  artistSlug: string;
  artistName: string;
  artistAvatarUrl: string | null;
  occurredAt: Date;
  isFollowed: boolean;
  genres: string[];
  moods: string[];
  plays30d: number;
  title: string;
  coverUrl: string | null;
  hasExplicit: boolean;
  // null для POST — у анонса нет типа релиза
  releaseType: string | null;
  // тело анонса; null для RELEASE/UPCOMING
  body: string | null;
}

export interface RankedFeedItem extends FeedCandidate {
  reason: FeedReason;
  score: number;
}

export interface FeedScoringContext {
  // резолвленный таймстемп (мс), не Clock — считает вызывающий, функция чистая
  now: number;
  taste: TasteProfile | null;
  followedArtistIds: ReadonlySet<string>;
}
