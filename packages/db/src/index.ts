export { db, ping } from './client';
export type { DB } from './client';
export * from './schema';
export * from './repositories/artist';
export * from './repositories/release';
export * from './repositories/track';
export { getTrackAudio, getTrackAudioMeta, trackExists, getTrackTitle, listTracksNeedingAnalysis, updateTrackAnalysis } from './queries/track-audio';
export type { TrackAudioData } from './queries/track-audio';
export { getPublicTrackLyrics } from './queries/lyrics';
export { listActiveArtists } from './queries/artists';
export type { ArtistListItem } from './queries/artists';
export { getLikeState, getLikeCount, likeTrack, unlikeTrack } from './queries/likes';
export { getFollowState, getFollowerCount, followArtist, unfollowArtist } from './queries/follows';
export { getFeed } from './queries/feed';
export type { FeedRelease } from './queries/feed';
export { getLatestReleases, getUpcomingReleases, getUpcomingByArtist, getTracksByIds, listReleases } from './queries/discovery';
export type { DiscoveryRelease, DiscoveryTrack, ReleaseSort } from './queries/discovery';
export { insertPlayEvent } from './queries/play-events';
export type { InsertPlayEventData } from './queries/play-events';
export { getLikedTracks, getFollowedArtists, getUserCreatedAt, getUserProfile, updateUserName, updateUserImage } from './queries/profile';
export type { LikedTrack, FollowedArtist } from './queries/profile';
export { searchAll } from './queries/search';
export type { SearchResults, SearchArtist, SearchRelease, SearchTrack } from './queries/search';
export { getArtistPlayStats, getArtistTrackIds } from './queries/artist-analytics';
export type { ArtistPlayStats, TrackPlayStat } from './queries/artist-analytics';
export { getArtistRelistenStats } from './queries/relisten';
export type { ArtistRelistenStats, RelistenTrack } from './queries/relisten';
export {
  listArtistPosts,
  getArtistPostById,
  createArtistPost,
  updateArtistPost,
  deleteArtistPost,
} from './queries/posts';
export type { ArtistPost } from './queries/posts';
export {
  hasPurchasedTrack,
  getPendingPurchase,
  createPendingPurchase,
  confirmPurchaseByExternalId,
  failPurchaseByExternalId,
  getPurchasedTracks,
} from './queries/purchases';
export type { PendingPurchase, PurchasedTrack } from './queries/purchases';
export {
  pingDb,
  getAdminStats,
  getAdminAttention,
  getRecentPublishedReleases,
  getAdminPlatformMetrics,
  getAdminDailyPlays,
  getAdminTopTracks,
  getAdminTopArtists,
  listUsersAdmin,
  setUserRole,
  verifyArtist,
  listArtistsAdmin,
  setArtistActive,
  listTracksAdmin,
  setTrackStatus,
  listReleasesAdmin,
  setReleaseStatus,
  createArtistForUser,
} from './queries/admin';
export type {
  AdminStats,
  AdminUser,
  AdminTrack,
  AdminRelease,
  AdminAttention,
  StuckTrack,
  UnverifiedArtist,
  AdminRecentRelease,
  AdminPlatformMetrics,
  AdminDailyPlays,
  AdminTopTrack,
  AdminTopArtist,
  AdminArtist,
} from './queries/admin';
export type { UserRole } from './queries/admin-types';
export { getFollowerEmails, getTrackOwnerContact } from './queries/notifications';
export type { TrackOwnerContact } from './queries/notifications';
export type { FollowerEmail } from './queries/notifications';
export {
  getTrackMoods, setTrackMoods, getMoodsForTracks, getMoodCounts, ALL_MOODS, MOOD_LABELS,
} from './queries/track-moods';
export type { Mood, MoodCount } from './queries/track-moods';
export { getTrackGenres, setTrackGenres, getGenresForTracks, ALL_TRACK_GENRES } from './queries/track-genres';
export type { TrackGenre } from './queries/track-genres';
export {
  getAggregateMoments, addFavoriteMoment, getMomentCount,
} from './queries/favorite-moments';
export type { MomentBucket } from './queries/favorite-moments';
export { getWaveNextTrack } from './queries/wave';
export type { WaveTrack } from './queries/wave';
export {
  getUserPlaylists,
  getPlaylistWithTracks,
  createPlaylist,
  deletePlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  getTrackPlaylistIds,
  renamePlaylist,
  getEditorialPlaylists,
  getPersonalPlaylists,
  getPopularPlaylists,
  getPublicUserPlaylists,
  upsertEditorialPlaylist,
  createPersonalPlaylist,
  deletePersonalPlaylists,
  likePlaylist,
  unlikePlaylist,
  getPlaylistLikeState,
  getLikedPlaylistIds,
} from './queries/playlists';
export type { PlaylistSummary, PlaylistWithTracks, PlaylistTrackRow, EditorialPlaylist } from './queries/playlists';
export {
  generateAllEditorialPlaylists,
  generateSharedPlaylists,
  generatePersonalPlaylistsForAllUsers,
  generatePersonalPlaylists,
} from './queries/editorial';
export {
  getSmartLinkBySlug,
  getSmartLinkById,
  getPublishedSmartLinks,
  listSmartLinks,
  smartLinkSlugTaken,
  createSmartLink,
  updateSmartLink,
  deleteSmartLink,
} from './queries/smart-links';
export type { SmartLinkInput } from './queries/smart-links';
export {
  findUserByEmail,
  createUserWithPassword,
  setUserPasswordHash,
  getUserLinkedProviders,
  getUserAuthInfo,
  findOrCreateTelegramUser,
  linkOAuthAccount,
  getUserById,
  tryClaimOAuthAccount,
} from './queries/users';
export type {
  UserWithPassword,
  LinkedProvider,
  UserAuthInfo,
  TelegramProfile,
  OAuthAccountData,
  LinkAccountResult,
} from './queries/users';
export type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
