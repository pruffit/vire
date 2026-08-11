import type { PlaylistEditorialParams } from '../../curation/types/playlist';

export interface HomeChartTrack {
  id: string;
  title: string;
  artistName: string;
  artistSlug: string;
  releaseId: string;
  coverUrl: string | null;
  accentColor: string | null;
  isExplicit: boolean;
  plays: number;
  version: string | null;
  feat: string[];
}

export interface HomePlaylistCard {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  editorialParams: PlaylistEditorialParams | null;
  trackCount: number;
  likesCount: number;
  covers: string[];
}

export interface HomePlaylistsBlock {
  playlists: HomePlaylistCard[];
  likedPlaylistIds: string[];
}
