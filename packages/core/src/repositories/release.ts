import type { Release, ReleaseStatus, ReleaseType, ReleaseWithTracks } from '../types/release';

export interface CreateReleaseInput {
  id: string;
  artistProfileId: string;
  title: string;
  type: ReleaseType;
  releaseDate?: Date | null;
  coverUrl?: string | null;
  description?: string | null;
}

export interface UpdateReleaseInput {
  title?: string;
  type?: ReleaseType;
  releaseDate?: Date | null;
  coverUrl?: string | null;
  description?: string | null;
  linerNotes?: string | null;
}

export interface IReleaseRepository {
  findById(releaseId: string): Promise<Release | null>;
  findWithTracks(releaseId: string): Promise<ReleaseWithTracks | null>;
  findPublishedByArtist(artistProfileId: string): Promise<Release[]>;
  findAllByArtist(artistProfileId: string): Promise<ReleaseWithTracks[]>;
  create(input: CreateReleaseInput): Promise<Release>;
  update(releaseId: string, input: UpdateReleaseInput): Promise<Release>;
  updateStatus(releaseId: string, status: ReleaseStatus): Promise<void>;
  delete(releaseId: string): Promise<void>;
}
