import type { ArtistProfile, SmartLink } from './artist';
import type { Release } from './release';
import type { ArtistPost } from './artist-post';
import type { ReleaseCard } from './release-card';

export type ArtistUpcomingRelease = ReleaseCard;

/** Форма — зеркало ArtistPlayableTrack (packages/db/src/queries/discovery.ts). */
export interface ArtistPlayableTrack {
  id: string;
  title: string;
  releaseId: string;
  coverUrl: string | null;
  durationSec: number | null;
  isExplicit: boolean;
  plays: number;
  version: string | null;
  feat: string[];
}

export interface ArtistPageView {
  artist: ArtistProfile;
  releases: Release[];
  upcoming: ArtistUpcomingRelease[];
  posts: ArtistPost[];
  smartLinks: SmartLink[];
  playableTracks: ArtistPlayableTrack[];
  explicitReleaseIds: Set<string>;
  following: boolean;
  followerCount: number;
  presavedReleaseIds: Set<string>;
}
