import { cache } from 'react';
import { getLikedTracks, getFollowedArtists, getUserPlaylists, getUserProfile, getListenerTaste, getLikedPlaylists } from '@vire/db';

// Request-scoped dedup: the listener layout and the page it wraps fetch the
// same library data on one render, cache() collapses that to one query each.
export const getLikedTracksCached = cache(getLikedTracks);
export const getFollowedArtistsCached = cache(getFollowedArtists);
export const getUserPlaylistsCached = cache(getUserPlaylists);
export const getLikedPlaylistsCached = cache(getLikedPlaylists);
// Layout (sidebar-user) и /profile читают один профиль на рендер: дедупим.
export const getUserProfileCached = cache(getUserProfile);
export const getListenerTasteCached = cache(getListenerTaste);
