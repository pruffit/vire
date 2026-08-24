import {
  playlistListResponseSchema,
  playlistDetailResponseSchema,
  createPlaylistResponseSchema,
  okResponseSchema,
  type PlaylistListResponse,
  type PlaylistDetailResponse,
  type CreatePlaylistResponse,
  type OkResponse,
} from '@vire/api-contracts';
import type { ApiResult } from '@vire/api-client';
import { apiRequest } from './api-client';

// Сегменты пути экранируем — тот же принцип, что packages/api-client/src/toggles.ts.
const seg = encodeURIComponent;

// Без trackId — все плейлисты вызывающего (для «Медиатеки»), не галочки под конкретный трек.
export function fetchPlaylists(): Promise<ApiResult<PlaylistListResponse>> {
  return apiRequest('/api/v1/playlists', { schema: playlistListResponseSchema });
}

export function fetchPlaylistsForTrack(trackId: string): Promise<ApiResult<PlaylistListResponse>> {
  return apiRequest(`/api/v1/playlists?trackId=${seg(trackId)}`, { schema: playlistListResponseSchema });
}

// Видимость решает сервер (playlistService().getForViewer) — приватный чужой плейлист
// отдаёт 403/404, apiRequest транслирует это в ApiResult.ok=false как обычно.
export function fetchPlaylistDetail(id: string): Promise<ApiResult<PlaylistDetailResponse>> {
  return apiRequest(`/api/v1/playlists/${seg(id)}`, { schema: playlistDetailResponseSchema });
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
