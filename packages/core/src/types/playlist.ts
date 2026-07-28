export type PlaylistVisibility = 'PRIVATE' | 'PUBLIC';
export type PlaylistRole = 'OWNER' | 'COLLABORATOR';

export interface PlaylistSummary {
  id: string;
  title: string;
  visibility: PlaylistVisibility;
  trackCount: number;
  coverUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Только у getUserPlaylists ("моя медиатека"); в остальных геттерах не заполняется. */
  role?: PlaylistRole;
}

export interface PlaylistTrackAddedBy {
  id: string;
  name: string | null;
  image: string | null;
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
  addedBy: PlaylistTrackAddedBy | null;
}

export interface PlaylistWithTracks {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  visibility: PlaylistVisibility;
  ownerUserId: string | null;
  likesCount: number;
  isCollaborative: boolean;
  version: number;
  tracks: PlaylistTrack[];
}

export interface PlaylistCollaborator {
  userId: string;
  name: string | null;
  image: string | null;
  joinedAt: Date;
}

/** Минимум данных для экрана приглашения — без состава треков. */
export interface PlaylistInvitePreview {
  title: string;
  ownerUserId: string;
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
