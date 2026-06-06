import type { Track, TrackCredit } from '../types/release';

export interface CreateTrackParams {
  id: string;
  releaseId: string;
  title: string;
  trackNumber: number;
  credits?: TrackCredit[];
}

export interface ITrackRepository {
  create(params: CreateTrackParams): Promise<Track>;
}
