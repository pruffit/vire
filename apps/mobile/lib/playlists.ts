import {
  playlistListResponseSchema,
  createPlaylistResponseSchema,
  okResponseSchema,
  type PlaylistListResponse,
  type CreatePlaylistResponse,
  type OkResponse,
} from '@vire/api-contracts';
import type { ApiResult } from '@vire/api-client';
import { apiRequest } from './api-client';

// Сегменты пути экранируем — тот же принцип, что packages/api-client/src/toggles.ts.
const seg = encodeURIComponent;

export function fetchPlaylistsForTrack(trackId: string): Promise<ApiResult<PlaylistListResponse>> {
  return apiRequest(`/api/v1/playlists?trackId=${seg(trackId)}`, { schema: playlistListResponseSchema });
}

export function addTrackToPlaylist(playlistId: string, trackId: string): Promise<ApiResult<OkResponse>> {
  return apiRequest(`/api/v1/playlists/${seg(playlistId)}/tracks`, {
    method: 'POST',
    schema: okResponseSchema,
    body: { trackId },
  });
}

export function removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<ApiResult<OkResponse>> {
  return apiRequest(`/api/v1/playlists/${seg(playlistId)}/tracks/${seg(trackId)}`, {
    method: 'DELETE',
    schema: okResponseSchema,
  });
}

export function createPlaylist(title: string): Promise<ApiResult<CreatePlaylistResponse>> {
  return apiRequest('/api/v1/playlists', {
    method: 'POST',
    schema: createPlaylistResponseSchema,
    body: { title },
  });
}
