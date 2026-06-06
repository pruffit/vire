export { db, ping } from './client';
export type { DB } from './client';
export * from './schema';
export * from './repositories/artist';
export * from './repositories/release';
export * from './repositories/track';
export { getTrackAudio, trackExists, getTrackTitle } from './queries/track-audio';
export type { TrackAudioData } from './queries/track-audio';
export { listActiveArtists } from './queries/artists';
export type { ArtistListItem } from './queries/artists';
export { getLikeState, getLikeCount, likeTrack, unlikeTrack } from './queries/likes';
export { getFollowState, getFollowerCount, followArtist, unfollowArtist } from './queries/follows';
export { getFeed } from './queries/feed';
export type { FeedRelease } from './queries/feed';
export { insertPlayEvent } from './queries/play-events';
export type { InsertPlayEventData } from './queries/play-events';
export { getLikedTracks, getFollowedArtists } from './queries/profile';
export type { LikedTrack, FollowedArtist } from './queries/profile';
export { searchAll } from './queries/search';
export type { SearchResults, SearchArtist, SearchRelease, SearchTrack } from './queries/search';
export { getArtistPlayStats } from './queries/artist-analytics';
export type { ArtistPlayStats, TrackPlayStat } from './queries/artist-analytics';
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
  getAdminStats,
  listUsersAdmin,
  setUserRole,
  verifyArtist,
  listTracksAdmin,
  setTrackStatus,
  listReleasesAdmin,
} from './queries/admin';
export type { AdminStats, AdminUser, AdminTrack, AdminRelease } from './queries/admin';
export type { UserRole } from './queries/admin-types';
export { getFollowerEmails } from './queries/notifications';
export type { FollowerEmail } from './queries/notifications';
export type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
