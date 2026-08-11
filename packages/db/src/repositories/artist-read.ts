import type { DB } from '../client';
import type {
  IArtistReadRepository,
  ArtistProfile,
  Release,
  ArtistPost,
  SmartLink,
  ArtistUpcomingRelease,
  ArtistPlayableTrack,
} from '@vire/core';
import { DrizzleArtistRepository } from './artist';
import { DrizzleReleaseRepository } from './release';
import { artistHasPublishedTrackById, isArtistMember } from '../queries/artists';
import { getUpcomingByArtist, getArtistPlayableTracks, getExplicitReleaseIds } from '../queries/discovery';
import { listArtistPosts } from '../queries/posts';
import { getPublishedSmartLinks } from '../queries/smart-links';
import { getFollowState, getFollowerCount } from '../queries/follows';
import { getPresaveStates } from '../queries/release-presaves';

/** Тонкие обёртки над существующими query-функциями — SQL живёт в queries/*, не здесь. */
export class DrizzleArtistReadRepository implements IArtistReadRepository {
  private readonly artistRepo: DrizzleArtistRepository;
  private readonly releaseRepo: DrizzleReleaseRepository;

  constructor(private readonly db: DB) {
    this.artistRepo = new DrizzleArtistRepository(db);
    this.releaseRepo = new DrizzleReleaseRepository(db);
  }

  findBySlug(slug: string): Promise<ArtistProfile | null> {
    return this.artistRepo.findBySlug(slug);
  }

  hasPublishedTrack(artistId: string): Promise<boolean> {
    return artistHasPublishedTrackById(artistId);
  }

  isMember(artistId: string, userId: string): Promise<boolean> {
    return isArtistMember(artistId, userId);
  }

  listPublishedReleases(artistId: string): Promise<Release[]> {
    return this.releaseRepo.findPublishedByArtist(artistId);
  }

  listUpcoming(artistId: string): Promise<ArtistUpcomingRelease[]> {
    return getUpcomingByArtist(artistId);
  }

  listPosts(artistId: string, limit: number): Promise<ArtistPost[]> {
    return listArtistPosts(artistId, limit);
  }

  listSmartLinks(artistId: string): Promise<SmartLink[]> {
    return getPublishedSmartLinks(artistId);
  }

  listPlayableTracks(artistId: string): Promise<ArtistPlayableTrack[]> {
    return getArtistPlayableTracks(artistId);
  }

  explicitReleaseIds(releaseIds: string[]): Promise<Set<string>> {
    return getExplicitReleaseIds(releaseIds);
  }

  followerCount(artistId: string): Promise<number> {
    return getFollowerCount(artistId);
  }

  isFollowing(userId: string, artistId: string): Promise<boolean> {
    return getFollowState(userId, artistId);
  }

  presavedReleaseIds(userId: string, releaseIds: string[]): Promise<Set<string>> {
    return getPresaveStates(userId, releaseIds);
  }
}
