import { followResponseSchema, likeResponseSchema, presaveResponseSchema } from '@vire/api-contracts';
import { request } from './http';
import type { ApiResult } from './result';
import type { FollowResponse, LikeResponse, PresaveResponse } from '@vire/api-contracts';

// Сегменты пути экранируем: клиент общий, а вызывающий не обязан знать, что слаг
// артиста прошёл валидацию где-то выше.
const seg = encodeURIComponent;

export function followArtist(slug: string, next: boolean): Promise<ApiResult<FollowResponse>> {
  return request(`/api/v1/artists/${seg(slug)}/follow`, { method: next ? 'POST' : 'DELETE', schema: followResponseSchema });
}

export function likeTrack(trackId: string, next: boolean): Promise<ApiResult<LikeResponse>> {
  return request(`/api/v1/tracks/${seg(trackId)}/like`, { method: next ? 'POST' : 'DELETE', schema: likeResponseSchema });
}

export function likePlaylist(playlistId: string, next: boolean): Promise<ApiResult<LikeResponse>> {
  return request(`/api/v1/playlists/${seg(playlistId)}/like`, { method: next ? 'POST' : 'DELETE', schema: likeResponseSchema });
}

export function presaveRelease(releaseId: string, next: boolean): Promise<ApiResult<PresaveResponse>> {
  return request(`/api/v1/releases/${seg(releaseId)}/presave`, { method: next ? 'POST' : 'DELETE', schema: presaveResponseSchema });
}

export function presaveReleaseAsGuest(releaseId: string, email: string): Promise<ApiResult<PresaveResponse>> {
  return request(`/api/v1/releases/${seg(releaseId)}/presave`, {
    method: 'POST',
    schema: presaveResponseSchema,
    body: { email },
  });
}
