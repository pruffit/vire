import type { ArtistProfile, SmartLink } from '../types/artist';
import type { Release } from '../types/release';
import type { ArtistPost } from '../types/artist-post';
import type { ArtistUpcomingRelease, ArtistPlayableTrack } from '../types/artist-page';

/** Read-порт для экрана артиста (Server Component и HTTP-роут читают через одну реализацию). */
export interface IArtistReadRepository {
  findBySlug(slug: string): Promise<ArtistProfile | null>;
  hasPublishedTrack(artistId: string): Promise<boolean>;
  isMember(artistId: string, userId: string): Promise<boolean>;
  listPublishedReleases(artistId: string): Promise<Release[]>;
  listUpcoming(artistId: string): Promise<ArtistUpcomingRelease[]>;
  listPosts(artistId: string, limit: number): Promise<ArtistPost[]>;
  listSmartLinks(artistId: string): Promise<SmartLink[]>;
  listPlayableTracks(artistId: string): Promise<ArtistPlayableTrack[]>;
  explicitReleaseIds(releaseIds: string[]): Promise<Set<string>>;
  followerCount(artistId: string): Promise<number>;
  isFollowing(userId: string, artistId: string): Promise<boolean>;
  presavedReleaseIds(userId: string, releaseIds: string[]): Promise<Set<string>>;
}
