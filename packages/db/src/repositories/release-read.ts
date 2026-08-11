import type { DB } from '../client';
import type { IReleaseReadRepository, ArtistProfile, ReleaseWithTracks } from '@vire/core';
import { DrizzleArtistRepository } from './artist';
import { DrizzleReleaseRepository } from './release';
import { getPresaveState } from '../queries/release-presaves';
import { artistHasPublishedTrackById, isArtistMember } from '../queries/artists';

/** Тонкие обёртки над существующими репозиториями/query-функциями — SQL живёт там, не здесь. */
export class DrizzleReleaseReadRepository implements IReleaseReadRepository {
  private readonly artistRepo: DrizzleArtistRepository;
  private readonly releaseRepo: DrizzleReleaseRepository;

  constructor(private readonly db: DB) {
    this.artistRepo = new DrizzleArtistRepository(db);
    this.releaseRepo = new DrizzleReleaseRepository(db);
  }

  findArtistBySlug(slug: string): Promise<ArtistProfile | null> {
    return this.artistRepo.findBySlug(slug);
  }

  findArtistById(id: string): Promise<ArtistProfile | null> {
    return this.artistRepo.findById(id);
  }

  findReleaseWithTracks(releaseId: string): Promise<ReleaseWithTracks | null> {
    return this.releaseRepo.findWithTracks(releaseId);
  }

  isPresaved(userId: string, releaseId: string): Promise<boolean> {
    return getPresaveState(userId, releaseId);
  }

  hasPublishedTrack(artistId: string): Promise<boolean> {
    return artistHasPublishedTrackById(artistId);
  }

  isMember(artistId: string, userId: string): Promise<boolean> {
    return isArtistMember(artistId, userId);
  }
}
