export type DiscoveryReason = 'friends' | 'similar' | 'taste';

// genres — уже расширены до семейств (expandGenresToFamilies) на стороне вызывающего;
// core про сам enum жанров не знает (источник правды — @vire/db).
export interface TasteSignature {
  genres: readonly string[];
  moods: readonly string[];
}

export interface DiscoveryCandidate {
  artistProfileId: string;
  artistSlug: string;
  artistName: string;
  artistAvatarUrl: string | null;
  verified: boolean;
  coListen: number;
  tasteOverlap: number;
  friendListeners: number;
  // артист-источник похожести — на нём держится кап "не больше 1 карточки на источник"
  sourceArtistId: string;
}

export interface RankedDiscoveryArtist extends DiscoveryCandidate {
  score: number;
  reason: DiscoveryReason;
}
