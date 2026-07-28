import type { DB } from '../client';
import type {
  IPlaylistRepository,
  IPlaylistCoverStorage,
  PlaylistUpdatePatch,
  PlaylistSummary,
  PlaylistWithTracks,
  PlaylistTrack,
  TrackSearchResult,
  PlaylistSuggestions,
  PlaylistCollaborator,
  PlaylistCollabState,
  JoinCollaboratorOutcome,
  PlaylistInvitePreview,
} from '@vire/core';
import {
  getUserPlaylists,
  getTrackPlaylistIds,
  createPlaylist,
  getPlaylistWithTracks,
  updatePlaylist,
  deletePlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  reorderPlaylistTracks,
  setPlaylistCover,
  searchTracksForPlaylist,
  getPlaylistSuggestions,
  getPlaylistLikeState,
  likePlaylist,
  unlikePlaylist,
  listPlaylistCollaborators,
  isPlaylistCollaborator,
  joinPlaylistCollaborator,
  removePlaylistCollaborator,
  setPlaylistCollaboration,
  getPlaylistCollabState,
  getPlaylistInvitePreview,
  getPlaylistTrackAddedBy,
  removeCollaboratorMembershipBetween,
  type PlaylistTrackRow,
  type PlaylistAddTrack,
} from '../queries/playlists';
import { trackExists as trackExistsQuery } from '../queries/track-audio';
import { adminUpdatePlaylist, adminDeletePlaylist } from '../queries/admin';

export class DrizzlePlaylistRepository implements IPlaylistRepository {
  constructor(private readonly db: DB) {}

  async listByUser(userId: string): Promise<PlaylistSummary[]> {
    return getUserPlaylists(userId);
  }

  trackMembership(userId: string, trackId: string): Promise<string[]> {
    return getTrackPlaylistIds(userId, trackId);
  }

  async create(userId: string, title: string): Promise<PlaylistSummary> {
    const id = await createPlaylist(userId, title);
    const now = new Date();
    return { id, title, visibility: 'PRIVATE', trackCount: 0, coverUrl: null, createdAt: now, updatedAt: now };
  }

  async getWithTracks(id: string): Promise<PlaylistWithTracks | null> {
    const playlist = await getPlaylistWithTracks(id);
    return playlist ? mapPlaylistWithTracks(playlist) : null;
  }

  update(id: string, userId: string, patch: PlaylistUpdatePatch): Promise<void> {
    return updatePlaylist(id, userId, patch);
  }

  delete(id: string, userId: string): Promise<boolean> {
    return deletePlaylist(id, userId);
  }

  addTrack(playlistId: string, trackId: string, userId: string): Promise<number | null> {
    return addTrackToPlaylist(playlistId, trackId, userId);
  }

  removeTrack(playlistId: string, trackId: string): Promise<number | null> {
    return removeTrackFromPlaylist(playlistId, trackId);
  }

  reorder(playlistId: string, userId: string, trackIds: string[]): Promise<number | null> {
    return reorderPlaylistTracks(playlistId, userId, trackIds);
  }

  setCover(playlistId: string, userId: string, coverUrl: string | null): Promise<void> {
    return setPlaylistCover(playlistId, userId, coverUrl);
  }

  async searchTracks(q: string, excludeIds: string[], limit: number): Promise<TrackSearchResult[]> {
    const rows = await searchTracksForPlaylist(q, excludeIds, limit);
    return rows.map(mapTrackSearchResult);
  }

  async suggestions(playlistId: string, userId: string): Promise<PlaylistSuggestions> {
    const suggestions = await getPlaylistSuggestions(playlistId, userId);
    return {
      liked: suggestions.liked.map(mapTrackSearchResult),
      recent: suggestions.recent.map(mapTrackSearchResult),
      similar: suggestions.similar.map(mapTrackSearchResult),
    };
  }

  getLikeState(userId: string, playlistId: string): Promise<boolean> {
    return getPlaylistLikeState(userId, playlistId);
  }

  like(userId: string, playlistId: string): Promise<void> {
    return likePlaylist(userId, playlistId);
  }

  unlike(userId: string, playlistId: string): Promise<void> {
    return unlikePlaylist(userId, playlistId);
  }

  trackExists(trackId: string): Promise<boolean> {
    return trackExistsQuery(trackId);
  }

  adminUpdate(id: string, patch: { title: string; visibility: 'PRIVATE' | 'PUBLIC' }): Promise<void> {
    return adminUpdatePlaylist(id, patch);
  }

  adminDelete(id: string): Promise<void> {
    return adminDeletePlaylist(id);
  }

  listCollaborators(playlistId: string): Promise<PlaylistCollaborator[]> {
    return listPlaylistCollaborators(playlistId);
  }

  isCollaborator(playlistId: string, userId: string): Promise<boolean> {
    return isPlaylistCollaborator(playlistId, userId);
  }

  joinCollaborator(playlistId: string, userId: string, invitedBy: string, maxCollaborators: number): Promise<JoinCollaboratorOutcome> {
    return joinPlaylistCollaborator(playlistId, userId, invitedBy, maxCollaborators);
  }

  removeCollaborator(playlistId: string, userId: string): Promise<boolean> {
    return removePlaylistCollaborator(playlistId, userId);
  }

  setCollaboration(playlistId: string, ownerId: string, input: { isCollaborative: boolean; collabToken: string | null }): Promise<void> {
    return setPlaylistCollaboration(playlistId, ownerId, input);
  }

  getCollabState(playlistId: string): Promise<PlaylistCollabState | null> {
    return getPlaylistCollabState(playlistId);
  }

  async getInvitePreview(playlistId: string): Promise<(PlaylistInvitePreview & { isCollaborative: boolean; collabToken: string | null }) | null> {
    const row = await getPlaylistInvitePreview(playlistId);
    if (!row || !row.ownerUserId) return null;
    return { title: row.title, ownerUserId: row.ownerUserId, isCollaborative: row.isCollaborative, collabToken: row.collabToken };
  }

  getTrackAddedBy(playlistId: string, trackId: string): Promise<string | null> {
    return getPlaylistTrackAddedBy(playlistId, trackId);
  }

  removeMembershipBetween(userA: string, userB: string): Promise<string[]> {
    return removeCollaboratorMembershipBetween(userA, userB);
  }
}

function mapPlaylistTrack(row: PlaylistTrackRow): PlaylistTrack {
  return { ...row };
}

function mapPlaylistWithTracks(row: NonNullable<Awaited<ReturnType<typeof getPlaylistWithTracks>>>): PlaylistWithTracks {
  return { ...row, tracks: row.tracks.map(mapPlaylistTrack) };
}

function mapTrackSearchResult(row: PlaylistAddTrack): TrackSearchResult {
  return { ...row };
}
