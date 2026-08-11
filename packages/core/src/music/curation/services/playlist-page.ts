import { err, ok, type NotFoundError, type ForbiddenError, type Result } from '../../../errors';
import type { IPlaylistPageRepository } from '../repositories/playlist-page';
import type { PlaylistWithTracks, PlaylistCollaborator, PlaylistInvitePreview } from '../types/playlist';
import type { PlaylistPageView, PlaylistPageRole } from '../types/playlist-page';

/** Узкий срез PlaylistService, которым пользуется экран — сам PlaylistService ему соответствует структурно. */
export interface IPlaylistPageAccess {
  getForViewer(
    id: string,
    viewerUserId: string | null,
    joinToken?: string,
  ): Promise<Result<PlaylistWithTracks, NotFoundError | ForbiddenError>>;
  checkInvite(id: string, token: string): Promise<Result<PlaylistInvitePreview, NotFoundError | ForbiddenError>>;
  listCollaborators(id: string, viewerId: string): Promise<Result<PlaylistCollaborator[], NotFoundError | ForbiddenError>>;
}

export interface PlaylistPageInput {
  playlistId: string;
  viewerId: string | null;
  joinToken?: string;
}

export class PlaylistPageService {
  constructor(
    private readonly playlists: IPlaylistPageAccess,
    private readonly repo: IPlaylistPageRepository,
  ) {}

  async getPage({ playlistId, viewerId, joinToken }: PlaylistPageInput): Promise<Result<PlaylistPageView, NotFoundError | ForbiddenError>> {
    const inviteResult = joinToken ? await this.playlists.checkInvite(playlistId, joinToken) : null;
    const invite = inviteResult?.ok ? inviteResult.value : null;

    const result = await this.playlists.getForViewer(playlistId, viewerId, joinToken);
    if (!result.ok) {
      // Анониму по валидной ссылке отдаём приглашение вместо ошибки — но без состава плейлиста.
      if (invite && joinToken && !viewerId) {
        return ok({ kind: 'invite', title: invite.title, ownerUserId: invite.ownerUserId });
      }
      return err(result.error);
    }
    const playlist = result.value;

    const isOwner = viewerId !== null && playlist.ownerUserId === viewerId;
    let role: PlaylistPageRole = isOwner ? 'OWNER' : 'VIEWER';
    let collaborators: PlaylistCollaborator[] = [];

    if (isOwner && viewerId) {
      const collabResult = await this.playlists.listCollaborators(playlistId, viewerId);
      if (collabResult.ok) collaborators = collabResult.value;
    } else if (viewerId && playlist.isCollaborative) {
      const collabResult = await this.playlists.listCollaborators(playlistId, viewerId);
      if (collabResult.ok) {
        collaborators = collabResult.value;
        role = 'COLLABORATOR';
      }
    }

    const showJoinBanner = playlist.isCollaborative && invite !== null && role === 'VIEWER';
    const inviterName = showJoinBanner && playlist.ownerUserId
      ? await this.repo.userName(playlist.ownerUserId)
      : null;

    const liked = viewerId && !isOwner ? await this.repo.likeState(viewerId, playlistId) : false;

    return ok({
      kind: 'playlist',
      playlist,
      role,
      collaborators,
      liked,
      invite: invite ? { title: invite.title, ownerUserId: invite.ownerUserId } : null,
      inviterName,
    });
  }
}
