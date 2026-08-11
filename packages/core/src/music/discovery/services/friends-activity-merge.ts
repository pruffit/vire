import type { FriendActivityItem, FriendFollowActivity, FriendLikeActivity, FriendPlaylistActivity } from '../types/home-blocks';

export const FRIENDS_ACTIVITY_LIMIT = 12;

export function mergeFriendsActivity(
  likes: FriendLikeActivity[],
  follows: FriendFollowActivity[],
  playlists: FriendPlaylistActivity[],
  limit = FRIENDS_ACTIVITY_LIMIT,
): FriendActivityItem[] {
  const items: FriendActivityItem[] = [
    ...likes.map((l): FriendActivityItem => ({ kind: 'like', ...l })),
    ...follows.map((f): FriendActivityItem => ({ kind: 'follow', ...f })),
    ...playlists.map((p): FriendActivityItem => ({ kind: 'playlist', ...p })),
  ];
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}

/** Стабильный ключ для рендера — переживает добавление новых событий в начало списка. */
export function friendActivityKey(item: FriendActivityItem): string {
  const id =
    item.kind === 'like' ? `${item.releaseId}:${item.trackTitle}`
    : item.kind === 'follow' ? item.artistSlug
    : item.playlistId;
  return `${item.kind}:${item.actor.id}:${id}:${item.at.getTime()}`;
}
