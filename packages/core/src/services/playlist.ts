import { err, ok, NotFoundError, ConflictError, ValidationError, type Result } from '../errors';
import type { IPlaylistRepository, IPlaylistCoverStorage, PlaylistUpdatePatch } from '../repositories/playlist';
import type { PlaylistSummary, PlaylistWithTracks, TrackSearchResult, PlaylistSuggestions } from '../types/playlist';

export interface PlaylistCoverFile {
  buffer: Buffer;
  contentType: string;
  ext: string;
}

const MIN_SEARCH_QUERY_LENGTH = 2;

function forbidden(): Error {
  return new Error('Forbidden: playlist does not belong to this user');
}

export class PlaylistService {
  constructor(
    private readonly repo: IPlaylistRepository,
    private readonly storage: IPlaylistCoverStorage,
    private readonly now: () => number,
  ) {}

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
  ): Promise<Result<PlaylistWithTracks, NotFoundError | Error>> {
    const playlist = await this.repo.getWithTracks(id);
    if (!playlist) return err(new NotFoundError('Playlist', id));
    if (playlist.visibility === 'PRIVATE' && playlist.ownerUserId !== viewerUserId) {
      return err(forbidden());
    }
    return ok(playlist);
  }

  async update(
    id: string,
    userId: string,
    patch: PlaylistUpdatePatch,
  ): Promise<Result<void, NotFoundError | Error>> {
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

  async addTrack(id: string, userId: string, trackId: string): Promise<Result<void, NotFoundError | Error>> {
    const playlist = await this.repo.getWithTracks(id);
    if (!playlist) return err(new NotFoundError('Playlist', id));
    if (playlist.ownerUserId !== userId) return err(forbidden());
    if (!(await this.repo.trackExists(trackId))) return err(new NotFoundError('Track', trackId));

    await this.repo.addTrack(id, trackId, userId);
    return ok(undefined);
  }

  async removeTrack(id: string, userId: string, trackId: string): Promise<Result<void, NotFoundError | Error>> {
    const playlist = await this.repo.getWithTracks(id);
    if (!playlist) return err(new NotFoundError('Playlist', id));
    if (playlist.ownerUserId !== userId) return err(forbidden());

    await this.repo.removeTrack(id, trackId);
    return ok(undefined);
  }

  async reorder(
    id: string,
    userId: string,
    trackIds: string[],
  ): Promise<Result<void, NotFoundError | ConflictError | Error>> {
    const playlist = await this.repo.getWithTracks(id);
    if (!playlist) return err(new NotFoundError('Playlist', id));
    if (playlist.ownerUserId !== userId) return err(forbidden());

    const success = await this.repo.reorder(id, userId, trackIds);
    if (!success) return err(new ConflictError('Playlist reorder', id));
    return ok(undefined);
  }

  async setCover(
    id: string,
    userId: string,
    file: PlaylistCoverFile | null,
  ): Promise<Result<string | null, NotFoundError | Error>> {
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
  ): Promise<Result<TrackSearchResult[], NotFoundError | Error>> {
    const playlist = await this.repo.getWithTracks(id);
    if (!playlist) return err(new NotFoundError('Playlist', id));
    if (playlist.ownerUserId !== userId) return err(forbidden());

    const trimmed = q.trim();
    if (trimmed.length < MIN_SEARCH_QUERY_LENGTH) return ok([]);

    const excludeIds = playlist.tracks.map((t) => t.id);
    return ok(await this.repo.searchTracks(trimmed, excludeIds, 20));
  }

  async suggestions(id: string, userId: string): Promise<Result<PlaylistSuggestions, NotFoundError | Error>> {
    const playlist = await this.repo.getWithTracks(id);
    if (!playlist) return err(new NotFoundError('Playlist', id));
    if (playlist.ownerUserId !== userId) return err(forbidden());

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
}
