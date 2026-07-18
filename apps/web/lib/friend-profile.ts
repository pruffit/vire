import { getUserPublicProfile, getLikedTracks, getPublicPlaylistsByOwner, type LikedTrack, type PlaylistSummary } from '@vire/db';
import { canSeeLikes, type FriendshipStatus } from '@vire/core';
import { friendshipService } from '@/lib/friends';

export type FriendProfileView = {
  id: string;
  name: string | null;
  image: string | null;
  status: FriendshipStatus;
  likesVisible: boolean;
  likes: LikedTrack[];
  playlists: PlaylistSummary[];
};

export async function loadFriendProfile(viewerId: string | null, targetUserId: string): Promise<FriendProfileView | null> {
  const profile = await getUserPublicProfile(targetUserId);
  if (!profile) return null;

  const status: FriendshipStatus = viewerId
    ? await friendshipService().getStatus(viewerId, targetUserId)
    : 'NONE';
  const areFriends = status === 'FRIENDS';
  const likesVisible = viewerId ? canSeeLikes(viewerId, targetUserId, profile.socialVisibility, areFriends) : false;

  const [likes, playlists] = await Promise.all([
    likesVisible ? getLikedTracks(targetUserId) : Promise.resolve([] as LikedTrack[]),
    getPublicPlaylistsByOwner(targetUserId),
  ]);

  return { id: profile.id, name: profile.name, image: profile.image, status, likesVisible, likes, playlists };
}
