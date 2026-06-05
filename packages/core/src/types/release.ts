export type ReleaseType = 'ALBUM' | 'EP' | 'SINGLE';
export type ReleaseStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
export type TrackStatus = 'PROCESSING' | 'READY' | 'BLOCKED';

export interface Release {
  id: string;
  artistProfileId: string;
  title: string;
  type: ReleaseType;
  coverUrl: string | null;
  releaseDate: Date | null;
  status: ReleaseStatus;
  description: string | null;
  linerNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Track {
  id: string;
  releaseId: string;
  title: string;
  trackNumber: number;
  durationSec: number | null;
  status: TrackStatus;
  isExclusive: boolean;
  isWip: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReleaseWithTracks {
  release: Release;
  tracks: Track[];
}
