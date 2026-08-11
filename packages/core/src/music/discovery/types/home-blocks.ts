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

export interface HomePersonalBlock {
  recentlyPlayed: HomeChartTrack[];
  personalPicks: HomeChartTrack[];
}

export interface FriendActor {
  id: string;
  name: string | null;
  image: string | null;
}

export interface FriendLikeActivity {
  actor: FriendActor;
  at: Date;
  trackTitle: string;
  artistName: string;
  artistSlug: string;
  releaseId: string;
}

export interface FriendFollowActivity {
  actor: FriendActor;
  at: Date;
  artistName: string;
  artistSlug: string;
}

export interface FriendPlaylistActivity {
  actor: FriendActor;
  at: Date;
  playlistId: string;
  title: string;
}

export interface FriendsActivity {
  likes: FriendLikeActivity[];
  follows: FriendFollowActivity[];
  playlists: FriendPlaylistActivity[];
}

export type FriendActivityItem =
  | ({ kind: 'like' } & FriendLikeActivity)
  | ({ kind: 'follow' } & FriendFollowActivity)
  | ({ kind: 'playlist' } & FriendPlaylistActivity);
