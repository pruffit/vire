import { z } from 'zod';
import { playlistTrackSchema, playlistCollaboratorSchema, playlistWithTracksSchema } from './playlist-page';

export const playlistSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  visibility: z.enum(['PRIVATE', 'PUBLIC']),
  trackCount: z.number(),
  coverUrl: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  role: z.enum(['OWNER', 'COLLABORATOR']).optional(),
});
export type PlaylistSummaryDTO = z.infer<typeof playlistSummarySchema>;

export const playlistListResponseSchema = z.object({
  playlists: z.array(playlistSummarySchema),
  inPlaylists: z.array(z.string()).optional(),
});
export type PlaylistListResponse = z.infer<typeof playlistListResponseSchema>;

export const createPlaylistSchema = z.object({ title: z.string().min(1).max(100) });
export type CreatePlaylistInput = z.infer<typeof createPlaylistSchema>;

export const createPlaylistResponseSchema = z.object({ id: z.string() });
export type CreatePlaylistResponse = z.infer<typeof createPlaylistResponseSchema>;

export const updatePlaylistSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullish(),
  visibility: z.enum(['PRIVATE', 'PUBLIC']).optional(),
});
export type UpdatePlaylistInput = z.infer<typeof updatePlaylistSchema>;

export const playlistDetailResponseSchema = z.object({ playlist: playlistWithTracksSchema });
export type PlaylistDetailResponse = z.infer<typeof playlistDetailResponseSchema>;

export const addPlaylistTrackSchema = z.object({ trackId: z.string().uuid() });
export type AddPlaylistTrackInput = z.infer<typeof addPlaylistTrackSchema>;

export const reorderPlaylistTracksSchema = z.object({ trackIds: z.array(z.string().uuid()).min(1) });
export type ReorderPlaylistTracksInput = z.infer<typeof reorderPlaylistTracksSchema>;

export const playlistTracksResponseSchema = z.object({
  tracks: z.array(playlistTrackSchema),
  version: z.number(),
});
export type PlaylistTracksResponse = z.infer<typeof playlistTracksResponseSchema>;

export const joinPlaylistSchema = z.object({ token: z.string().min(1) });
export type JoinPlaylistInput = z.infer<typeof joinPlaylistSchema>;

export const playlistCollaboratorsResponseSchema = z.object({
  collaborators: z.array(playlistCollaboratorSchema),
});
export type PlaylistCollaboratorsResponse = z.infer<typeof playlistCollaboratorsResponseSchema>;

export const playlistJoinResponseSchema = z.object({ playlist: playlistWithTracksSchema });
export type PlaylistJoinResponse = z.infer<typeof playlistJoinResponseSchema>;

export const setCollaborationSchema = z.object({ enabled: z.boolean() });
export type SetCollaborationInput = z.infer<typeof setCollaborationSchema>;

export const collaborationInviteResponseSchema = z.object({ inviteUrl: z.string().nullable() });
export type CollaborationInviteResponse = z.infer<typeof collaborationInviteResponseSchema>;

export const collaborationPatchResponseSchema = z.object({
  isCollaborative: z.boolean(),
  inviteUrl: z.string().nullable(),
});
export type CollaborationPatchResponse = z.infer<typeof collaborationPatchResponseSchema>;

export const collaborationRotateResponseSchema = z.object({ inviteUrl: z.string() });
export type CollaborationRotateResponse = z.infer<typeof collaborationRotateResponseSchema>;

export const playlistSearchQuerySchema = z.object({ q: z.string() });
export type PlaylistSearchQuery = z.infer<typeof playlistSearchQuerySchema>;

const trackSearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  durationSec: z.number().nullable(),
  releaseId: z.string(),
  artistName: z.string(),
  artistSlug: z.string(),
  coverUrl: z.string().nullable(),
  accentColor: z.string().nullable(),
  isExplicit: z.boolean(),
  version: z.string().nullable(),
  feat: z.array(z.string()),
});

export const playlistSearchResponseSchema = z.object({ tracks: z.array(trackSearchResultSchema) });
export type PlaylistSearchResponse = z.infer<typeof playlistSearchResponseSchema>;

export const playlistCoverResponseSchema = z.object({ ok: z.boolean(), coverUrl: z.string().nullable() });
export type PlaylistCoverResponse = z.infer<typeof playlistCoverResponseSchema>;

export const playlistSuggestionsResponseSchema = z.object({
  liked: z.array(trackSearchResultSchema),
  recent: z.array(trackSearchResultSchema),
  similar: z.array(trackSearchResultSchema),
});
export type PlaylistSuggestionsResponse = z.infer<typeof playlistSuggestionsResponseSchema>;
