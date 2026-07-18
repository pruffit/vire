import { cache } from 'react';
import {
  getLikedTracks,
  getFollowedArtists,
  getUserPlaylists,
  getUserProfile,
  getUserPublicProfile,
  getListenerTaste,
  getLikedPlaylists,
} from '@vire/db';
import { friendshipService } from '@/lib/friends';

// Request-scoped dedup: the listener layout and the page it wraps fetch the
// same library data on one render, cache() collapses that to one query each.
export const getLikedTracksCached = cache(getLikedTracks);
export const getFollowedArtistsCached = cache(getFollowedArtists);
export const getUserPlaylistsCached = cache(getUserPlaylists);
export const getLikedPlaylistsCached = cache(getLikedPlaylists);
// Layout (sidebar-user) и /profile читают один профиль на рендер: дедупим.
export const getUserProfileCached = cache(getUserProfile);
export const getUserPublicProfileCached = cache(getUserPublicProfile);
export const getListenerTasteCached = cache(getListenerTaste);
export const countUnseenIncomingCached = cache((userId: string) => friendshipService().countUnseen(userId));
