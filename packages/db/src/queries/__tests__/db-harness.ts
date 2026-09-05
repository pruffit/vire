import { sql } from 'drizzle-orm';
import { db } from '../../client';
import { users } from '../../schema/users';
import { artistProfiles } from '../../schema/artists';
import { releases, tracks, trackAudio, trackGenres, trackMoods } from '../../schema/releases';
import type { TrackGenre } from '../track-genres';
import type { Mood } from '../track-moods';
import { playlists, playlistTracks, friendships, likes, follows } from '../../schema/interactions';
import { playEvents } from '../../schema/analytics';

/**
 * Чистит данные между тестами. Корневые таблицы перечислены явно, остальное снимает CASCADE:
 * перебор всех 44 таблиц через pg_tables занимал больше 10с на хук.
 */
export async function resetDb(): Promise<void> {
  await db.execute(
    sql.raw('truncate table "users", "artist_profiles", "releases", "tracks", "playlists", "play_events" restart identity cascade'),
  );
}

let seq = 0;
const uniq = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${seq++}`;

export async function makeUser(overrides: Partial<typeof users.$inferInsert> = {}) {
  const [row] = await db.insert(users).values({ email: `${uniq('user')}@test.local`, ...overrides }).returning();
  return row!;
}

export async function makeArtist(
  overrides: Partial<typeof artistProfiles.$inferInsert> = {},
): Promise<typeof artistProfiles.$inferSelect> {
  const user = await makeUser();
  const [row] = await db
    .insert(artistProfiles)
    .values({ userId: user.id, slug: uniq('artist'), name: 'Тестовый артист', ...overrides })
    .returning();
  return row!;
}

export async function makeRelease(
  artistProfileId: string,
  overrides: Partial<typeof releases.$inferInsert> = {},
): Promise<typeof releases.$inferSelect> {
  const [row] = await db
    .insert(releases)
    .values({ artistProfileId, title: 'Тестовый релиз', status: 'PUBLISHED', ...overrides })
    .returning();
  return row!;
}

export async function makeTrack(
  releaseId: string,
  overrides: Partial<typeof tracks.$inferInsert> = {},
): Promise<typeof tracks.$inferSelect> {
  const [row] = await db
    .insert(tracks)
    .values({ releaseId, title: 'Тестовый трек', trackNumber: 1, status: 'READY', ...overrides })
    .returning();
  return row!;
}

/** Артист, видимый публике: активен и с опубликованным READY-треком. */
export async function makeVisibleArtist(overrides: Partial<typeof artistProfiles.$inferInsert> = {}) {
  const artist = await makeArtist(overrides);
  const release = await makeRelease(artist.id);
  const track = await makeTrack(release.id);
  return { artist, release, track };
}

export async function makePlaylist(
  ownerUserId: string,
  overrides: Partial<typeof playlists.$inferInsert> = {},
): Promise<typeof playlists.$inferSelect> {
  const [row] = await db
    .insert(playlists)
    .values({ ownerUserId, title: 'Тестовый плейлист', visibility: 'PRIVATE', kind: 'USER', ...overrides })
    .returning();
  return row!;
}

export async function addPlaylistTrack(playlistId: string, trackId: string, position = 1): Promise<void> {
  await db.insert(playlistTracks).values({ playlistId, trackId, position });
}

export async function addTrackAudio(
  trackId: string,
  overrides: Partial<typeof trackAudio.$inferInsert> = {},
): Promise<void> {
  await db
    .insert(trackAudio)
    .values({ trackId, hlsManifestKey: `stream/${trackId}/index.m3u8`, ...overrides });
}

export async function addTrackGenres(trackId: string, genres: TrackGenre[]): Promise<void> {
  await db.insert(trackGenres).values(genres.map((genre) => ({ trackId, genre })));
}

export async function addTrackMoods(trackId: string, moods: Mood[]): Promise<void> {
  await db.insert(trackMoods).values(moods.map((mood) => ({ trackId, mood })));
}

export async function makeFriendship(requesterId: string, addresseeId: string): Promise<void> {
  await db.insert(friendships).values({ requesterId, addresseeId, status: 'ACCEPTED' });
}

export async function likeTrack(userId: string, trackId: string): Promise<void> {
  await db.insert(likes).values({ userId, trackId });
}

export async function addPlayEvent(
  trackId: string,
  userId: string | null,
  overrides: Partial<typeof playEvents.$inferInsert> = {},
): Promise<void> {
  await db
    .insert(playEvents)
    .values({ trackId, userId, sessionId: `sess-${trackId}-${userId ?? 'anon'}`, durationPlayedSec: 120, ...overrides });
}

export async function followArtist(userId: string, artistProfileId: string): Promise<void> {
  await db.insert(follows).values({ userId, artistProfileId });
}
