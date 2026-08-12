import { z } from 'zod';

const playlistTrackAddedBySchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  image: z.string().nullable(),
});

export const playlistTrackSchema = z.object({
  id: z.string(),
  title: z.string(),
  durationSec: z.number().nullable(),
  position: z.number(),
  artistName: z.string(),
  artistSlug: z.string(),
  releaseId: z.string(),
  coverUrl: z.string().nullable(),
  accentColor: z.string().nullable(),
  isExplicit: z.boolean(),
  version: z.string().nullable(),
  feat: z.array(z.string()),
  addedBy: playlistTrackAddedBySchema.nullable(),
});

export const playlistWithTracksSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  coverUrl: z.string().nullable(),
  kind: z.string(),
  editorialParams: z.object({ mood: z.string() }).nullable(),
  visibility: z.enum(['PRIVATE', 'PUBLIC']),
  ownerUserId: z.string().nullable(),
  likesCount: z.number(),
  isCollaborative: z.boolean(),
  version: z.number(),
  tracks: z.array(playlistTrackSchema),
});

export const playlistCollaboratorSchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  image: z.string().nullable(),
  joinedAt: z.string(),
});

const playlistPageInviteSchema = z.object({
  title: z.string(),
  ownerUserId: z.string().nullable(),
});

export const playlistPageResponseSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('invite'),
    title: z.string(),
    ownerUserId: z.string().nullable(),
  }),
  z.object({
    kind: z.literal('playlist'),
    playlist: playlistWithTracksSchema,
    role: z.enum(['OWNER', 'COLLABORATOR', 'VIEWER']),
    collaborators: z.array(playlistCollaboratorSchema),
    liked: z.boolean(),
    invite: playlistPageInviteSchema.nullable(),
    inviterName: z.string().nullable(),
  }),
]);
export type PlaylistPageResponse = z.infer<typeof playlistPageResponseSchema>;
