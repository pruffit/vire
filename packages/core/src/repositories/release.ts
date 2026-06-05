import type { Release, ReleaseWithTracks } from '../types/release';

export interface IReleaseRepository {
  findById(releaseId: string): Promise<Release | null>;
  findWithTracks(releaseId: string): Promise<ReleaseWithTracks | null>;
  findPublishedByArtist(artistProfileId: string): Promise<Release[]>;
  findAllByArtist(artistProfileId: string): Promise<ReleaseWithTracks[]>;
}
