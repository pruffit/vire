import type { Track } from '../types/release';

export interface CreateTrackParams {
  id: string;
  releaseId: string;
  title: string;
  trackNumber: number;
}

export interface ITrackRepository {
  create(params: CreateTrackParams): Promise<Track>;
}
