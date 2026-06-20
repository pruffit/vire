import { eq } from 'drizzle-orm';
import { db } from '../client';
import { follows, users, tracks, releases, artistProfiles } from '../schema';

export interface FollowerEmail {
  email: string;
  name: string | null;
}

export async function getFollowerEmails(artistProfileId: string): Promise<FollowerEmail[]> {
  const rows = await db
    .select({ email: users.email, name: users.name })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.userId))
    .where(eq(follows.artistProfileId, artistProfileId));

  // Telegram-пользователи не имеют email — их пропускаем для рассылок
  return rows.filter((r): r is FollowerEmail => r.email !== null);
}

export interface TrackOwnerContact {
  email: string;
  name: string | null;
  trackTitle: string;
  releaseId: string;
  artistSlug: string;
}

/**
 * Контакт владельца трека (артиста) для сервисных уведомлений — например, о
 * падении транскодинга. Путь: track → release → artist_profile → user.
 * Возвращает null, если у владельца нет email (теоретически невозможно для
 * артиста, но защищаемся).
 */
export async function getTrackOwnerContact(trackId: string): Promise<TrackOwnerContact | null> {
  const [row] = await db
    .select({
      email: users.email,
      name: users.name,
      trackTitle: tracks.title,
      releaseId: tracks.releaseId,
      artistSlug: artistProfiles.slug,
    })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .innerJoin(users, eq(users.id, artistProfiles.userId))
    .where(eq(tracks.id, trackId))
    .limit(1);

  if (!row || !row.email) return null;
  return {
    email: row.email,
    name: row.name,
    trackTitle: row.trackTitle,
    releaseId: row.releaseId,
    artistSlug: row.artistSlug,
  };
}
