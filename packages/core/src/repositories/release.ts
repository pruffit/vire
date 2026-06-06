import type { Release, ReleaseType, ReleaseWithTracks } from '../types/release';

export interface CreateReleaseInput {
  id: string;
  artistProfileId: string;
  title: string;
  type: ReleaseType;
  releaseDate?: Date | null;
  coverUrl?: string | null;
  description?: string | null;
}

export interface IReleaseRepository {
  findById(releaseId: string): Promise<Release | null>;
  findWithTracks(releaseId: string): Promise<ReleaseWithTracks | null>;
  findPublishedByArtist(artistProfileId: string): Promise<Release[]>;
  findAllByArtist(artistProfileId: string): Promise<ReleaseWithTracks[]>;
  create(input: CreateReleaseInput): Promise<Release>;
}
