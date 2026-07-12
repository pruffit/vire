import type { PlaylistSummary, PlaylistWithTracks, TrackSearchResult, PlaylistSuggestions } from '../types/playlist';
import type { IFileStorage } from './storage';

export interface PlaylistUpdatePatch {
  title?: string;
  description?: string | null;
  visibility?: 'PRIVATE' | 'PUBLIC';
}

export interface IPlaylistRepository {
  listByUser(userId: string): Promise<PlaylistSummary[]>;
  /** id плейлистов пользователя, содержащих трек (getTrackPlaylistIds). */
  trackMembership(userId: string, trackId: string): Promise<string[]>;
  create(userId: string, title: string): Promise<PlaylistSummary>;
  getWithTracks(id: string): Promise<PlaylistWithTracks | null>;
  update(id: string, userId: string, patch: PlaylistUpdatePatch): Promise<void>;
  /** Владение проверяется в WHERE репозитория (1:1 с текущим поведением). */
  delete(id: string, userId: string): Promise<boolean>;
  addTrack(playlistId: string, trackId: string, userId: string): Promise<void>;
  removeTrack(playlistId: string, trackId: string): Promise<void>;
  /** Permutation-проверка — в транзакции репозитория (1:1). */
  reorder(playlistId: string, userId: string, trackIds: string[]): Promise<boolean>;
  setCover(playlistId: string, userId: string, coverUrl: string | null): Promise<void>;
  searchTracks(q: string, excludeIds: string[], limit: number): Promise<TrackSearchResult[]>;
  /** Use-case остаётся в query-слое (осознанный долг) — репозиторий делегирует как есть. */
  suggestions(playlistId: string, userId: string): Promise<PlaylistSuggestions>;
  getLikeState(userId: string, playlistId: string): Promise<boolean>;
  like(userId: string, playlistId: string): Promise<void>;
  unlike(userId: string, playlistId: string): Promise<void>;
  trackExists(trackId: string): Promise<boolean>;
}

export type IPlaylistCoverStorage = IFileStorage;
