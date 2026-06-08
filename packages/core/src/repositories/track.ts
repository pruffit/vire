import type { Track, TrackCredit } from '../types/release';

export interface CreateTrackParams {
  id: string;
  releaseId: string;
  title: string;
  trackNumber: number;
  credits?: TrackCredit[];
}

export interface UpdateTrackParams {
  title?: string;
  trackNumber?: number;
  isExclusive?: boolean;
  isWip?: boolean;
}

export interface ITrackRepository {
  create(params: CreateTrackParams): Promise<Track>;
  findById(id: string): Promise<Track | null>;
  update(id: string, patch: UpdateTrackParams): Promise<Track | null>;
  delete(id: string): Promise<void>;
}
