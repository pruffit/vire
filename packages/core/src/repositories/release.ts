import type { Release, ReleaseWithTracks } from '../types/release';

export interface IReleaseRepository {
  findWithTracks(releaseId: string): Promise<ReleaseWithTracks | null>;
  findPublishedByArtist(artistProfileId: string): Promise<Release[]>;
}
