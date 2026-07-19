export { db, ping } from './client';
export type { DB } from './client';
export * from './schema';
export * from './repositories/artist';
export * from './repositories/artist-post';
export * from './repositories/smart-link';
export * from './repositories/release';
export * from './repositories/track';
export * from './repositories/follow';
export * from './repositories/user-directory';
export * from './repositories/listener-track';
export * from './repositories/track-moods';
export * from './repositories/playlist';
export * from './repositories/wave';
export * from './repositories/search';
export * from './repositories/presave';
export * from './repositories/purchase';
export { getTrackAudio, getPlayableTrackAudio, getTrackArtistProfileId, getTrackSourceKey, getArtistTrackSources, getTrackAudioMeta, trackExists, getTrackTitle, listTracksNeedingAnalysis, updateTrackAnalysis, getGenreSuggestionsForTracks, saveGenreSuggestions, getGenreSuggestionsSnapshot, getAudioFeaturesSnapshot } from './queries/track-audio';
export type { TrackAudioData, PlayableTrackAudioData, GenreSuggestionRow, GenreSuggestionsSnapshot, AudioFeaturesSnapshot } from './queries/track-audio';
export { getPublicTrackLyrics } from './queries/lyrics';
export { listActiveArtists, artistHasPublishedTrackById, isArtistMember } from './queries/artists';
export type { ArtistListItem } from './queries/artists';
export { getLikeState, getLikeCount, likeTrack, unlikeTrack } from './queries/likes';
export {
  presaveForUser,
  unpresaveForUser,
  presaveForGuest,
  getPresaveState,
  getPresaveStates,
  getPresaveCount,
  deletePendingGuestPresavesByEmail,
  getReleasePresaveInfo,
  findDueScheduledReleases,
  publishScheduledRelease,
  getPresaverUserIds,
  getPresaverContacts,
  getReadyTrackIds,
  bulkLikeTracks,
  markPresavesFulfilled,
} from './queries/release-presaves';
export type { ReleasePresaveInfo, DueRelease, PresaverContact } from './queries/release-presaves';
export { getFollowState, getFollowerCount, followArtist, unfollowArtist } from './queries/follows';
export { getFeed } from './queries/feed';
export type { FeedRelease } from './queries/feed';
export { getLatestReleases, getUpcomingReleases, getUpcomingByArtist, getTracksByIds, listReleases, getExplicitReleaseIds, listTrackIdsByReleaseIds, getArtistPlayableTracks, getPopularTracks, getRecentlyPlayed, getPersonalTrackPicks, getReleaseCardStats } from './queries/discovery';
export type { DiscoveryRelease, DiscoveryTrack, ReleaseSort, ArtistPlayableTrack, PlayableChartTrack, ReleaseCardStats } from './queries/discovery';
export { insertPlayEvent } from './queries/play-events';
export type { InsertPlayEventData } from './queries/play-events';
export { getLikedTracks, getFollowedArtists, getUserCreatedAt, getUserProfile, updateUserName, updateUserImage, getUserPublicProfile, updateUserSocialVisibility, updateUserDiscoverable, updateUserNotifyEmail, updateUserNotifyPush, getUserNotifyContext, getUserDisplayName } from './queries/profile';
export type { LikedTrack, FollowedArtist } from './queries/profile';
export { upsertPushSubscription, deletePushSubscription, deletePushSubscriptionsByEndpoints, listPushSubscriptions } from './queries/push-subscriptions';
export { getListenerTaste } from './queries/listener-taste';
export type { ListenerTaste } from './queries/listener-taste';
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
  getArtistCore,
  adminUpdateArtist,
  listTracksAdmin,
  setTrackStatus,
  listReleasesAdmin,
  setReleaseStatus,
  listPostsAdmin,
  listPlaylistsAdmin,
  adminUpdatePlaylist,
  adminDeletePlaylist,
  createArtistForUser,
  listArtistMembers,
  addArtistMember,
  removeArtistMember,
} from './queries/admin';
export type {
  ArtistMemberRow,
  AdminStats,
  AdminUser,
  AdminTrack,
  AdminRelease,
  AdminPost,
  AdminPlaylist,
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
export { getTrackGenres, setTrackGenres, setTrackGenresIfEmpty, getGenresForTracks, getGenreCounts, ALL_TRACK_GENRES } from './queries/track-genres';
export type { TrackGenre, GenreCount } from './queries/track-genres';
export { GENRE_FAMILY, expandGenresToFamilies } from './genre-families';
export type { GenreFamily } from './genre-families';
export { getTasteProfile, clearTasteProfileCache, materializeTasteProfiles } from './queries/taste';
export type { TasteProfile } from './queries/taste';
export {
  getAggregateMoments, addFavoriteMoment, getMomentCount,
} from './queries/favorite-moments';
export type { MomentBucket } from './queries/favorite-moments';
export { getWaveTracks, getTrackMusicalKey, getArtistIdsForTracks } from './queries/wave';
export type { WaveTrack } from './queries/wave';
export type { WaveParams } from '@vire/core';
export {
  getUserPlaylists,
  getPlaylistWithTracks,
  createPlaylist,
  deletePlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  getTrackPlaylistIds,
  renamePlaylist,
  reorderPlaylistTracks,
  updatePlaylist,
  setPlaylistCover,
  isPermutation,
  fetchPlaylistMeta,
  pickCovers,
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
  getLikedPlaylists,
  getLikedPlaylistIds,
  searchTracksForPlaylist,
  getPlaylistSuggestions,
  getPublicPlaylistsByOwner,
} from './queries/playlists';
export type { PlaylistSummary, PlaylistWithTracks, PlaylistTrackRow, EditorialPlaylist, PlaylistAddTrack, PlaylistSuggestions, PlaylistMeta } from './queries/playlists';
export {
  generateAllEditorialPlaylists,
  generateSharedPlaylists,
  generatePersonalPlaylistsForAllUsers,
  generatePersonalPlaylists,
} from './queries/editorial';
export { snapshotPlatformMetricsDaily, getPlatformMetricsHistory } from './queries/metrics';
export type { PlatformMetricsDay } from './queries/metrics';
export {
  getSmartLinkBySlug,
  getSmartLinkById,
  getSmartLinkRelease,
  getReleaseOptions,
  getPublishedSmartLinks,
  listSmartLinks,
  smartLinkSlugTaken,
  createSmartLink,
  updateSmartLink,
  deleteSmartLink,
} from './queries/smart-links';
export type { SmartLinkInput, SmartLinkRelease, ReleaseOption } from './queries/smart-links';
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
export * from './repositories/user-account';
export * from './repositories/friendship';
export {
  findEdge, insertRequest, acceptRequest, deleteEdge, listFriends, listIncoming, userExists,
  listEdges, countUnseenIncoming, markRequestsSeen,
} from './queries/friendships';
export { searchUsersByName } from './queries/user-directory';
export * from './repositories/block';
export { blockUser, unblockUser, isBlockedEitherWay, isBlockedBy, listBlockedIds, blockedPairsExpr } from './queries/blocks';
export * from './repositories/report';
export {
  hasOpenReport, insertReport, listOpenReports, countOpenReports, getReportContext, resolveReport,
} from './queries/reports';
export * from './repositories/notification';
export {
  insertNotification, listNotifications, countUnreadNotifications, markAllNotificationsRead, markNotificationRead,
} from './queries/notifications';
export * from './repositories/chat';
export {
  findConversation, upsertConversation, getConversation, insertMessage, listMessages,
  listConversations, markConversationRead, countUnreadConversations,
} from './queries/chat';
export { getFriendsActivity } from './queries/friends-activity';
export type {
  FriendsActivity, FriendActor, FriendLikeActivity, FriendFollowActivity, FriendPlaylistActivity,
} from './queries/friends-activity';
export type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
