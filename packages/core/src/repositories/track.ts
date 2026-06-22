import type { Track, TrackCredit, LyricLine } from '../types/release';

export interface CreateTrackParams {
  id: string;
  releaseId: string;
  title: string;
  trackNumber: number;
  credits?: TrackCredit[];
}

export interface UpdateTrackParams {
  title?: string;
  version?: string | null;
  trackNumber?: number;
  isExclusive?: boolean;
  isWip?: boolean;
  isExplicit?: boolean;
  bpm?: number | null;
  musicalKey?: string | null;
  credits?: TrackCredit[];
  lyrics?: LyricLine[] | null;
}

export interface ITrackRepository {
  create(params: CreateTrackParams): Promise<Track>;
  findById(id: string): Promise<Track | null>;
  update(id: string, patch: UpdateTrackParams): Promise<Track | null>;
  delete(id: string): Promise<void>;
  /**
   * Перенумеровать треки релиза по новому порядку (id[i] → trackNumber i+1).
   * Атомарно (одна транзакция). Затрагивает только треки этого релиза.
   */
  reorder(releaseId: string, orderedIds: string[]): Promise<void>;
}
