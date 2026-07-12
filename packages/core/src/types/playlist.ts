export type PlaylistVisibility = 'PRIVATE' | 'PUBLIC';

export interface PlaylistSummary {
  id: string;
  title: string;
  visibility: PlaylistVisibility;
  trackCount: number;
  coverUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlaylistTrack {
  id: string;
  title: string;
  durationSec: number | null;
  position: number;
  artistName: string;
  artistSlug: string;
  releaseId: string;
  coverUrl: string | null;
  accentColor: string | null;
  isExplicit: boolean;
  version: string | null;
  feat: string[];
}

export interface PlaylistWithTracks {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  visibility: PlaylistVisibility;
  ownerUserId: string | null;
  likesCount: number;
  tracks: PlaylistTrack[];
}

export interface TrackSearchResult {
  id: string;
  title: string;
  durationSec: number | null;
  releaseId: string;
  artistName: string;
  artistSlug: string;
  coverUrl: string | null;
  accentColor: string | null;
  isExplicit: boolean;
  version: string | null;
  feat: string[];
}

export interface PlaylistSuggestions {
  liked: TrackSearchResult[];
  recent: TrackSearchResult[];
  similar: TrackSearchResult[];
}
