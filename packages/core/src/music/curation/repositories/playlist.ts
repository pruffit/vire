import type { PlaylistSummary, PlaylistWithTracks, TrackSearchResult, PlaylistSuggestions, PlaylistCollaborator, PlaylistInvitePreview } from '../types/playlist';
import type { IFileStorage } from '../../../platform/storage/repositories/storage';

export interface PlaylistUpdatePatch {
  title?: string;
  description?: string | null;
  visibility?: 'PRIVATE' | 'PUBLIC';
}

export interface PlaylistCollabState {
  isCollaborative: boolean;
  collabToken: string | null;
  version: number;
  ownerUserId: string | null;
}

export type JoinCollaboratorOutcome = 'joined' | 'already' | 'full';

export interface IPlaylistRepository {
  listByUser(userId: string): Promise<PlaylistSummary[]>;
  /** id плейлистов пользователя, содержащих трек (getTrackPlaylistIds). */
  trackMembership(userId: string, trackId: string): Promise<string[]>;
  create(userId: string, title: string): Promise<PlaylistSummary>;
  getWithTracks(id: string): Promise<PlaylistWithTracks | null>;
  update(id: string, userId: string, patch: PlaylistUpdatePatch): Promise<void>;
  /** Владение проверяется в WHERE репозитория (1:1 с текущим поведением). */
  delete(id: string, userId: string): Promise<boolean>;
  /** Версия состава инкрементится в той же транзакции (лочит строку плейлиста) —
   *  возвращает новую версию; null, если состав фактически не изменился (no-op). */
  addTrack(playlistId: string, trackId: string, userId: string): Promise<number | null>;
  removeTrack(playlistId: string, trackId: string): Promise<number | null>;
  /** Permutation-проверка — в транзакции репозитория; null = конфликт (1:1 с текущим boolean). */
  reorder(playlistId: string, userId: string, trackIds: string[]): Promise<number | null>;
  setCover(playlistId: string, userId: string, coverUrl: string | null): Promise<void>;
  searchTracks(q: string, excludeIds: string[], limit: number): Promise<TrackSearchResult[]>;
  /** Use-case остаётся в query-слое (осознанный долг) — репозиторий делегирует как есть. */
  suggestions(playlistId: string, userId: string): Promise<PlaylistSuggestions>;
  getLikeState(userId: string, playlistId: string): Promise<boolean>;
  like(userId: string, playlistId: string): Promise<void>;
  unlike(userId: string, playlistId: string): Promise<void>;
  trackExists(trackId: string): Promise<boolean>;
  /** Правка/удаление без owner-проверки (админ). */
  adminUpdate(id: string, patch: { title: string; visibility: 'PRIVATE' | 'PUBLIC' }): Promise<void>;
  adminDelete(id: string): Promise<void>;

  listCollaborators(playlistId: string): Promise<PlaylistCollaborator[]>;
  isCollaborator(playlistId: string, userId: string): Promise<boolean>;
  /** Атомарно (лочит строку плейлиста): вставляет коллаборатора, если ещё не участник и лимит не исчерпан. */
  joinCollaborator(playlistId: string, userId: string, invitedBy: string, maxCollaborators: number): Promise<JoinCollaboratorOutcome>;
  /** true, если строка реально была удалена (не no-op). */
  removeCollaborator(playlistId: string, userId: string): Promise<boolean>;
  /** Владение проверяется в WHERE репозитория. Выключение обнуляет collabToken на стороне вызывающего. */
  setCollaboration(playlistId: string, ownerId: string, input: { isCollaborative: boolean; collabToken: string | null }): Promise<void>;
  getCollabState(playlistId: string): Promise<PlaylistCollabState | null>;
  /** Лёгкая проверка ссылки-приглашения — без состава треков. */
  getInvitePreview(playlistId: string): Promise<PlaylistInvitePreview & { isCollaborative: boolean; collabToken: string | null } | null>;
  getTrackAddedBy(playlistId: string, trackId: string): Promise<string | null>;
  /** Снимает членство коллаборатора в плейлистах друг друга (обе стороны блокировки). Возвращает id затронутых плейлистов. */
  removeMembershipBetween(userA: string, userB: string): Promise<string[]>;
}

export type IPlaylistCoverStorage = IFileStorage;
