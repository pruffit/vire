import { err, ok, NotFoundError, ConflictError, ValidationError, ForbiddenError, type Result } from '../errors';
import type { IPlaylistRepository, IPlaylistCoverStorage, PlaylistUpdatePatch } from '../repositories/playlist';
import type { PlaylistSummary, PlaylistWithTracks, TrackSearchResult, PlaylistSuggestions, PlaylistCollaborator, PlaylistInvitePreview } from '../types/playlist';
import type { IBlockRepository } from '../repositories/block';
import type { INotificationRepository } from '../repositories/notification';
import type { IPlaylistBroadcaster } from '../ports/playlist-realtime';
import type { IdGenerator } from '../ports/effects';

export interface PlaylistCoverFile {
  buffer: Buffer;
  contentType: string;
  ext: string;
}

const MIN_SEARCH_QUERY_LENGTH = 2;
export const PLAYLIST_MAX_COLLABORATORS = 50;

function forbidden(message = 'Forbidden: playlist does not belong to this user'): ForbiddenError {
  return new ForbiddenError(message);
}

export class PlaylistService {
  constructor(
    private readonly repo: IPlaylistRepository,
    private readonly storage: IPlaylistCoverStorage,
    private readonly now: () => number,
    private readonly blocks: IBlockRepository,
    private readonly notifications: INotificationRepository,
    private readonly broadcaster: IPlaylistBroadcaster,
    private readonly uuid: IdGenerator,
  ) {}

  private async canEdit(playlist: PlaylistWithTracks, userId: string): Promise<boolean> {
    if (playlist.ownerUserId === userId) return true;
    if (!playlist.isCollaborative) return false;
    return this.repo.isCollaborator(playlist.id, userId);
  }

  private async broadcastChange(playlistId: string, version: number, actorId: string): Promise<void> {
    try {
      await this.broadcaster.broadcast(playlistId, { type: 'playlist:changed', playlistId, version, actorId });
    } catch {
      // best-effort: сбой брокера не должен валить мутацию
    }
  }

  private async broadcastCollaborators(playlistId: string, actorId: string): Promise<void> {
    try {
      await this.broadcaster.broadcast(playlistId, { type: 'playlist:collaborators', playlistId, actorId });
    } catch {
      // best-effort
    }
  }

  async listForUser(
    userId: string,
    trackId?: string,
  ): Promise<Result<{ playlists: PlaylistSummary[]; inPlaylists?: string[] }, Error>> {
    const playlists = await this.repo.listByUser(userId);
    if (trackId === undefined) return ok({ playlists });
    const inPlaylists = await this.repo.trackMembership(userId, trackId);
    return ok({ playlists, inPlaylists });
  }

  async create(userId: string, title: string): Promise<Result<PlaylistSummary, Error>> {
    return ok(await this.repo.create(userId, title));
  }

  async getForViewer(
    id: string,
    viewerUserId: string | null,
    joinToken?: string,
  ): Promise<Result<PlaylistWithTracks, NotFoundError | ForbiddenError>> {
    const playlist = await this.repo.getWithTracks(id);
    if (!playlist) return err(new NotFoundError('Playlist', id));
    if (playlist.visibility !== 'PRIVATE') return ok(playlist);
    if (playlist.ownerUserId === viewerUserId) return ok(playlist);

    if (playlist.isCollaborative) {
      if (viewerUserId && (await this.repo.isCollaborator(id, viewerUserId))) return ok(playlist);
      // Токен пускает к составу только авторизованного — анониму отдаём лишь checkInvite-превью.
      if (joinToken && viewerUserId) {
        const state = await this.repo.getCollabState(id);
        if (state?.collabToken && state.collabToken === joinToken) return ok(playlist);
      }
    }
    return err(forbidden());
  }

  /** Лёгкая проверка ссылки-приглашения (без состава треков) — доступна и анониму. */
  async checkInvite(
    id: string,
    token: string,
  ): Promise<Result<PlaylistInvitePreview, NotFoundError | ForbiddenError>> {
    const preview = await this.repo.getInvitePreview(id);
    if (!preview) return err(new NotFoundError('Playlist', id));
    if (!preview.isCollaborative || !preview.collabToken || preview.collabToken !== token || !preview.ownerUserId) {
      return err(forbidden('Неверная ссылка-приглашение'));
    }
    return ok({ title: preview.title, ownerUserId: preview.ownerUserId });
  }

  async update(
    id: string,
    userId: string,
    patch: PlaylistUpdatePatch,
  ): Promise<Result<void, NotFoundError | ForbiddenError>> {
    const playlist = await this.repo.getWithTracks(id);
    if (!playlist) return err(new NotFoundError('Playlist', id));
    if (playlist.ownerUserId !== userId) return err(forbidden());

    const normalized: PlaylistUpdatePatch = {};
    if (patch.title !== undefined) normalized.title = patch.title.trim();
    if (patch.description !== undefined) {
      normalized.description = patch.description === null ? null : patch.description.trim();
    }
    if (patch.visibility !== undefined) normalized.visibility = patch.visibility;

    await this.repo.update(id, userId, normalized);
    return ok(undefined);
  }

  // false → NotFound и при «не найден», и при «не владелец» (boolean из repo, 1:1).
  async delete(id: string, userId: string): Promise<Result<void, NotFoundError>> {
    const deleted = await this.repo.delete(id, userId);
    if (!deleted) return err(new NotFoundError('Playlist', id));
    return ok(undefined);
  }

  async addTrack(id: string, userId: string, trackId: string): Promise<Result<void, NotFoundError | ForbiddenError>> {
    const playlist = await this.repo.getWithTracks(id);
    if (!playlist) return err(new NotFoundError('Playlist', id));
    if (!(await this.canEdit(playlist, userId))) return err(forbidden());
    if (!(await this.repo.trackExists(trackId))) return err(new NotFoundError('Track', trackId));

    const version = await this.repo.addTrack(id, trackId, userId);
    if (version !== null) await this.broadcastChange(id, version, userId);
    return ok(undefined);
  }

  async removeTrack(id: string, userId: string, trackId: string): Promise<Result<void, NotFoundError | ForbiddenError>> {
    const playlist = await this.repo.getWithTracks(id);
    if (!playlist) return err(new NotFoundError('Playlist', id));

    if (playlist.ownerUserId !== userId) {
      if (!(await this.canEdit(playlist, userId))) return err(forbidden());
      const addedBy = await this.repo.getTrackAddedBy(id, trackId);
      if (addedBy !== userId) return err(forbidden('Можно удалить только добавленные вами треки'));
    }

    const version = await this.repo.removeTrack(id, trackId);
    if (version !== null) await this.broadcastChange(id, version, userId);
    return ok(undefined);
  }

  async reorder(
    id: string,
    userId: string,
    trackIds: string[],
  ): Promise<Result<void, NotFoundError | ConflictError | ForbiddenError>> {
    const playlist = await this.repo.getWithTracks(id);
    if (!playlist) return err(new NotFoundError('Playlist', id));
    if (!(await this.canEdit(playlist, userId))) return err(forbidden());

    const version = await this.repo.reorder(id, userId, trackIds);
    if (version === null) return err(new ConflictError('Playlist reorder', id));
    await this.broadcastChange(id, version, userId);
    return ok(undefined);
  }

  async setCover(
    id: string,
    userId: string,
    file: PlaylistCoverFile | null,
  ): Promise<Result<string | null, NotFoundError | ForbiddenError>> {
    const playlist = await this.repo.getWithTracks(id);
    if (!playlist) return err(new NotFoundError('Playlist', id));
    if (playlist.ownerUserId !== userId) return err(forbidden());

    if (file === null) {
      await this.repo.setCover(id, userId, null);
      return ok(null);
    }

    const url = await this.storage.upload(`playlists/${id}.${file.ext}`, file.buffer, file.contentType);
    const coverUrl = `${url}?v=${this.now()}`;
    await this.repo.setCover(id, userId, coverUrl);
    return ok(coverUrl);
  }

  async searchForAdding(
    id: string,
    userId: string,
    q: string,
  ): Promise<Result<TrackSearchResult[], NotFoundError | ForbiddenError>> {
    const playlist = await this.repo.getWithTracks(id);
    if (!playlist) return err(new NotFoundError('Playlist', id));
    if (!(await this.canEdit(playlist, userId))) return err(forbidden());

    const trimmed = q.trim();
    if (trimmed.length < MIN_SEARCH_QUERY_LENGTH) return ok([]);

    const excludeIds = playlist.tracks.map((t) => t.id);
    return ok(await this.repo.searchTracks(trimmed, excludeIds, 20));
  }

  async suggestions(id: string, userId: string): Promise<Result<PlaylistSuggestions, NotFoundError | ForbiddenError>> {
    const playlist = await this.repo.getWithTracks(id);
    if (!playlist) return err(new NotFoundError('Playlist', id));
    if (!(await this.canEdit(playlist, userId))) return err(forbidden());

    return ok(await this.repo.suggestions(id, userId));
  }

  async getLikeState(userId: string, id: string): Promise<Result<boolean, Error>> {
    return ok(await this.repo.getLikeState(userId, id));
  }

  async like(userId: string, id: string): Promise<Result<void, Error>> {
    await this.repo.like(userId, id);
    return ok(undefined);
  }

  async unlike(userId: string, id: string): Promise<Result<void, Error>> {
    await this.repo.unlike(userId, id);
    return ok(undefined);
  }

  async adminUpdate(
    id: string,
    input: { title: string; visibility: string },
  ): Promise<Result<void, ValidationError>> {
    const title = (input.title ?? '').trim();
    if (!title || title.length > 200) return err(new ValidationError('Название: 1–200 символов'));
    if (input.visibility !== 'PRIVATE' && input.visibility !== 'PUBLIC') {
      return err(new ValidationError('Неверная видимость'));
    }

    await this.repo.adminUpdate(id, { title, visibility: input.visibility });
    return ok(undefined);
  }

  async adminDelete(id: string): Promise<Result<void, Error>> {
    await this.repo.adminDelete(id);
    return ok(undefined);
  }

  async setCollaboration(
    id: string,
    ownerId: string,
    enabled: boolean,
  ): Promise<Result<{ collabToken: string | null }, NotFoundError | ForbiddenError>> {
    const playlist = await this.repo.getWithTracks(id);
    if (!playlist) return err(new NotFoundError('Playlist', id));
    if (playlist.ownerUserId !== ownerId) return err(forbidden());

    const collabToken = enabled ? this.uuid() : null;
    await this.repo.setCollaboration(id, ownerId, { isCollaborative: enabled, collabToken });
    return ok({ collabToken });
  }

  async getInviteToken(
    id: string,
    ownerId: string,
  ): Promise<Result<{ collabToken: string | null }, NotFoundError | ForbiddenError>> {
    const state = await this.repo.getCollabState(id);
    if (!state) return err(new NotFoundError('Playlist', id));
    if (state.ownerUserId !== ownerId) return err(forbidden());
    return ok({ collabToken: state.isCollaborative ? state.collabToken : null });
  }

  async rotateCollabToken(
    id: string,
    ownerId: string,
  ): Promise<Result<{ collabToken: string }, NotFoundError | ForbiddenError | ConflictError>> {
    const playlist = await this.repo.getWithTracks(id);
    if (!playlist) return err(new NotFoundError('Playlist', id));
    if (playlist.ownerUserId !== ownerId) return err(forbidden());
    if (!playlist.isCollaborative) return err(new ConflictError('Playlist is not collaborative'));

    const collabToken = this.uuid();
    await this.repo.setCollaboration(id, ownerId, { isCollaborative: true, collabToken });
    return ok({ collabToken });
  }

  private async notifyJoin(ownerId: string, actorId: string, playlistId: string): Promise<void> {
    try {
      await this.notifications.insert(ownerId, 'PLAYLIST_COLLAB_JOIN', actorId, playlistId);
    } catch {
      // best-effort: сбой уведомления не должен валить join — пользователь уже в команде
    }
  }

  async join(
    id: string,
    userId: string,
    token: string,
  ): Promise<Result<{ playlist: PlaylistWithTracks }, NotFoundError | ForbiddenError | ConflictError>> {
    const state = await this.repo.getCollabState(id);
    if (!state) return err(new NotFoundError('Playlist', id));
    if (!state.isCollaborative || !state.collabToken || state.collabToken !== token) {
      return err(forbidden('Неверная ссылка-приглашение'));
    }
    if (!state.ownerUserId || state.ownerUserId === userId) {
      return err(forbidden('Владелец не может присоединиться к своему плейлисту'));
    }
    if (await this.blocks.existsEitherWay(state.ownerUserId, userId)) {
      return err(forbidden('Присоединиться нельзя'));
    }

    // Одна транзакция репозитория: лочит строку плейлиста, проверяет лимит и
    // вставляет коллаборатора атомарно — иначе параллельные join на границе лимита оба проходят.
    const outcome = await this.repo.joinCollaborator(id, userId, state.ownerUserId, PLAYLIST_MAX_COLLABORATORS);
    if (outcome === 'full') return err(new ConflictError('Плейлист заполнен'));
    if (outcome === 'joined') {
      await this.notifyJoin(state.ownerUserId, userId, id);
      await this.broadcastCollaborators(id, userId);
    }

    const playlist = await this.repo.getWithTracks(id);
    if (!playlist) return err(new NotFoundError('Playlist', id));
    return ok({ playlist });
  }

  async leave(id: string, userId: string): Promise<Result<void, NotFoundError | ForbiddenError>> {
    const state = await this.repo.getCollabState(id);
    if (!state) return err(new NotFoundError('Playlist', id));
    if (!(await this.repo.isCollaborator(id, userId))) return err(forbidden());

    const removed = await this.repo.removeCollaborator(id, userId);
    if (removed) await this.broadcastCollaborators(id, userId);
    return ok(undefined);
  }

  async kick(id: string, ownerId: string, targetUserId: string): Promise<Result<void, NotFoundError | ForbiddenError>> {
    const state = await this.repo.getCollabState(id);
    if (!state) return err(new NotFoundError('Playlist', id));
    if (state.ownerUserId !== ownerId) return err(forbidden());

    const removed = await this.repo.removeCollaborator(id, targetUserId);
    if (removed) await this.broadcastCollaborators(id, ownerId);
    return ok(undefined);
  }

  /** Блокировка снимает совместное членство в обе стороны; вызывается из composition root (route блокировки). */
  async removeMembershipBetween(userA: string, userB: string): Promise<void> {
    const affected = await this.repo.removeMembershipBetween(userA, userB);
    for (const playlistId of affected) {
      await this.broadcastCollaborators(playlistId, userA);
    }
  }

  async listCollaborators(id: string, viewerId: string): Promise<Result<PlaylistCollaborator[], NotFoundError | ForbiddenError>> {
    const state = await this.repo.getCollabState(id);
    if (!state) return err(new NotFoundError('Playlist', id));

    const isOwner = state.ownerUserId === viewerId;
    if (!isOwner && !(await this.repo.isCollaborator(id, viewerId))) return err(forbidden());

    return ok(await this.repo.listCollaborators(id));
  }

  async assertStreamAccess(id: string, userId: string): Promise<Result<{ version: number }, NotFoundError | ForbiddenError>> {
    const state = await this.repo.getCollabState(id);
    if (!state) return err(new NotFoundError('Playlist', id));
    if (!state.isCollaborative) return err(forbidden());

    const isOwner = state.ownerUserId === userId;
    if (!isOwner && !(await this.repo.isCollaborator(id, userId))) return err(forbidden());

    return ok({ version: state.version });
  }
}
