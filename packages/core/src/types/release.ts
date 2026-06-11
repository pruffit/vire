export type ReleaseType = 'ALBUM' | 'EP' | 'SINGLE';

// Жанры — фиксированный список (как mood-теги: без свободного ввода и модерации).
// Заполняет артист при создании/редактировании релиза.
export const ALL_GENRES = [
  'ELECTRONIC', 'HIPHOP', 'ROCK', 'INDIE', 'POP', 'AMBIENT', 'JAZZ',
  'CLASSICAL', 'METAL', 'FOLK', 'RNB', 'TECHNO', 'EXPERIMENTAL', 'LOFI',
] as const;
export type Genre = (typeof ALL_GENRES)[number];
export type ContributorRole = 'PERFORMER' | 'LYRICIST' | 'COMPOSER' | 'PRODUCER';

export interface TrackCredit {
  name: string;
  role: ContributorRole;
}
export type ReleaseStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
export type TrackStatus = 'PROCESSING' | 'READY' | 'BLOCKED';

export interface Release {
  id: string;
  artistProfileId: string;
  title: string;
  type: ReleaseType;
  genre: Genre | null;
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
  credits: TrackCredit[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ReleaseWithTracks {
  release: Release;
  tracks: Track[];
}
