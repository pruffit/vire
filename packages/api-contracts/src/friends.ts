import { z } from 'zod';
import { uuidSchema } from './common';
import { playlistSummarySchema } from './playlist';

export const friendshipStatusSchema = z.enum(['NONE', 'OUTGOING', 'INCOMING', 'FRIENDS', 'SELF']);
export type FriendshipStatusDTO = z.infer<typeof friendshipStatusSchema>;

// since — ISO-строка: в core это Date, маппинг делает route handler (DTO-граница волны 3).
export const friendSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  image: z.string().nullable(),
  since: z.string(),
});
export type FriendDTO = z.infer<typeof friendSchema>;

export const incomingRequestSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  image: z.string().nullable(),
  requestedAt: z.string(),
});
export type IncomingRequestDTO = z.infer<typeof incomingRequestSchema>;

export const friendsResponseSchema = z.object({
  friends: z.array(friendSchema),
  incoming: z.array(incomingRequestSchema),
});
export type FriendsResponse = z.infer<typeof friendsResponseSchema>;

export const friendSearchHitSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  image: z.string().nullable(),
  status: friendshipStatusSchema,
});
export type FriendSearchHitDTO = z.infer<typeof friendSearchHitSchema>;

export const friendSearchResponseSchema = z.object({ results: z.array(friendSearchHitSchema) });
export type FriendSearchResponse = z.infer<typeof friendSearchResponseSchema>;

export const friendRequestBodySchema = z.object({ userId: uuidSchema });
export type FriendRequestBody = z.infer<typeof friendRequestBodySchema>;

export const friendRequestResponseSchema = z.object({ status: friendshipStatusSchema });
export type FriendRequestResponse = z.infer<typeof friendRequestResponseSchema>;

// likedAt — ISO-строка: в @vire/db LikedTrack.likedAt это Date, маппинг делает route handler.
export const likedTrackSchema = z.object({
  id: z.string(),
  title: z.string(),
  version: z.string().nullable(),
  durationSec: z.number().nullable(),
  releaseId: z.string(),
  releaseCoverUrl: z.string().nullable(),
  artistName: z.string(),
  artistSlug: z.string(),
  isExplicit: z.boolean(),
  likedAt: z.string(),
  feat: z.array(z.string()),
});
export type LikedTrackDTO = z.infer<typeof likedTrackSchema>;

export const userProfileResponseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  image: z.string().nullable(),
  status: friendshipStatusSchema,
  blocked: z.boolean(),
  likesVisible: z.boolean(),
  likes: z.array(likedTrackSchema),
  playlists: z.array(playlistSummarySchema),
});
export type UserProfileResponse = z.infer<typeof userProfileResponseSchema>;
