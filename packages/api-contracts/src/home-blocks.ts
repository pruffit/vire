import { z } from 'zod';
import { releaseCardSchema } from './catalog';

export const freshReleasesResponseSchema = z.object({
  items: z.array(releaseCardSchema),
});
export type FreshReleasesResponse = z.infer<typeof freshReleasesResponseSchema>;

export const upcomingResponseSchema = z.object({
  items: z.array(releaseCardSchema),
});
export type UpcomingResponse = z.infer<typeof upcomingResponseSchema>;

export const homeChartTrackSchema = z.object({
  id: z.string(),
  title: z.string(),
  artistName: z.string(),
  artistSlug: z.string(),
  releaseId: z.string(),
  coverUrl: z.string().nullable(),
  // С умолчанием, а не просто nullable: нативный клиент обновляется отдельно от сервера и
  // обязан разбирать ответ версии, которая этого поля ещё не знает. Требуемое поле роняло
  // весь блок в ошибку разбора — на экране это выглядело пустой главной.
  durationSec: z.number().nullable().default(null),
  accentColor: z.string().nullable(),
  isExplicit: z.boolean(),
  plays: z.number(),
  version: z.string().nullable(),
  feat: z.array(z.string()),
});
export type HomeChartTrackDTO = z.infer<typeof homeChartTrackSchema>;

export const hotTracksResponseSchema = z.object({
  items: z.array(homeChartTrackSchema),
});
export type HotTracksResponse = z.infer<typeof hotTracksResponseSchema>;

export const homePlaylistCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  kind: z.string(),
  editorialParams: z.object({ mood: z.string() }).nullable(),
  trackCount: z.number(),
  likesCount: z.number(),
  covers: z.array(z.string()),
});
export type HomePlaylistCardDTO = z.infer<typeof homePlaylistCardSchema>;

export const homePlaylistsResponseSchema = z.object({
  playlists: z.array(homePlaylistCardSchema),
  likedPlaylistIds: z.array(z.string()),
});
export type HomePlaylistsResponse = z.infer<typeof homePlaylistsResponseSchema>;

export const personalBlockResponseSchema = z.object({
  recentlyPlayed: z.array(homeChartTrackSchema),
  personalPicks: z.array(homeChartTrackSchema),
});
export type PersonalBlockResponse = z.infer<typeof personalBlockResponseSchema>;

const friendActorSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  image: z.string().nullable(),
});

const friendActivityItemSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('like'),
    actor: friendActorSchema,
    at: z.string(),
    trackTitle: z.string(),
    artistName: z.string(),
    artistSlug: z.string(),
    releaseId: z.string(),
  }),
  z.object({
    kind: z.literal('follow'),
    actor: friendActorSchema,
    at: z.string(),
    artistName: z.string(),
    artistSlug: z.string(),
  }),
  z.object({
    kind: z.literal('playlist'),
    actor: friendActorSchema,
    at: z.string(),
    playlistId: z.string(),
    title: z.string(),
  }),
]);
export type FriendActivityItemDTO = z.infer<typeof friendActivityItemSchema>;

export const friendsActivityResponseSchema = z.object({
  items: z.array(friendActivityItemSchema),
});
export type FriendsActivityResponse = z.infer<typeof friendsActivityResponseSchema>;
