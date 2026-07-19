import { getUserPublicProfile, getLikedTracks, getPublicPlaylistsByOwner, type LikedTrack, type PlaylistSummary } from '@vire/db';
import { canSeeLikes, type FriendshipStatus } from '@vire/core';
import { friendshipService } from '@/lib/friends';
import { blockService } from '@/lib/blocks';

export type FriendProfileView = {
  id: string;
  name: string | null;
  image: string | null;
  status: FriendshipStatus;
  likesVisible: boolean;
  likes: LikedTrack[];
  playlists: PlaylistSummary[];
  canChat: boolean;
  // blocked — блок в любую сторону (гейтит лайки/чат/заявки); iBlockedThem — я инициатор (могу разблокировать)
  blocked: boolean;
  iBlockedThem: boolean;
};

export async function loadFriendProfile(viewerId: string | null, targetUserId: string): Promise<FriendProfileView | null> {
  const profile = await getUserPublicProfile(targetUserId);
  if (!profile) return null;

  const blocked = viewerId ? await blockService().isBlocked(viewerId, targetUserId) : false;
  const iBlockedThem = viewerId && blocked ? await blockService().isBlockedByMe(viewerId, targetUserId) : false;

  const status: FriendshipStatus = viewerId
    ? await friendshipService().getStatus(viewerId, targetUserId)
    : 'NONE';
  const areFriends = status === 'FRIENDS';
  const likesVisible = viewerId && !blocked ? canSeeLikes(viewerId, targetUserId, profile.socialVisibility, areFriends) : false;
  const canChat = Boolean(viewerId && areFriends && !blocked);

  const [likes, playlists] = await Promise.all([
    likesVisible ? getLikedTracks(targetUserId) : Promise.resolve([] as LikedTrack[]),
    getPublicPlaylistsByOwner(targetUserId),
  ]);

  return {
    id: profile.id, name: profile.name, image: profile.image, status,
    likesVisible, likes, playlists, canChat, blocked, iBlockedThem,
  };
}
