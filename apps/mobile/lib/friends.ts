import {
  friendsResponseSchema,
  friendSearchResponseSchema,
  friendRequestResponseSchema,
  okResponseSchema,
  type FriendsResponse,
  type FriendSearchResponse,
  type FriendRequestResponse,
  type OkResponse,
} from '@vire/api-contracts';
import type { ApiResult } from '@vire/api-client';
import { apiRequest } from './api-client';

// Сегменты пути экранируем — тот же принцип, что apps/mobile/lib/playlists.ts.
const seg = encodeURIComponent;

export function fetchFriends(): Promise<ApiResult<FriendsResponse>> {
  return apiRequest('/api/v1/friends', { schema: friendsResponseSchema });
}

export function searchUsers(query: string): Promise<ApiResult<FriendSearchResponse>> {
  return apiRequest(`/api/v1/friends/search?q=${seg(query)}`, { schema: friendSearchResponseSchema });
}

export function sendFriendRequest(userId: string): Promise<ApiResult<FriendRequestResponse>> {
  return apiRequest('/api/v1/friends/request', {
    method: 'POST',
    schema: friendRequestResponseSchema,
    body: { userId },
  });
}

export function acceptFriendRequest(userId: string): Promise<ApiResult<OkResponse>> {
  return apiRequest(`/api/v1/friends/${seg(userId)}/accept`, { method: 'POST', schema: okResponseSchema });
}

// decline входящей/отмена исходящей/unfriend — один и тот же DELETE, семантика решается UI.
export function removeFriendEdge(userId: string): Promise<ApiResult<OkResponse>> {
  return apiRequest(`/api/v1/friends/${seg(userId)}`, { method: 'DELETE', schema: okResponseSchema });
}
