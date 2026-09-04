import { sql } from 'drizzle-orm';
import { db } from '../../client';
import { users } from '../../schema/users';
import { artistProfiles } from '../../schema/artists';
import { releases, tracks } from '../../schema/releases';
import { playlists, playlistTracks } from '../../schema/interactions';

/**
 * Чистит данные между тестами. Корневые таблицы перечислены явно, остальное снимает CASCADE:
 * перебор всех 44 таблиц через pg_tables занимал больше 10с на хук.
 */
export async function resetDb(): Promise<void> {
  await db.execute(
    sql.raw('truncate table "users", "artist_profiles", "releases", "tracks", "playlists" restart identity cascade'),
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
