import { and, count, eq, inArray, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import { db } from '../client';
import { releasePresaves, releases, tracks, likes, users, artistProfiles } from '../schema';

/** Пресейв залогиненного пользователя (идемпотентно). */
export async function presaveForUser(userId: string, releaseId: string): Promise<void> {
  await db
    .insert(releasePresaves)
    .values({ releaseId, userId })
    .onConflictDoNothing({ target: [releasePresaves.releaseId, releasePresaves.userId] });
}

export async function unpresaveForUser(userId: string, releaseId: string): Promise<void> {
  await db
    .delete(releasePresaves)
    .where(and(eq(releasePresaves.releaseId, releaseId), eq(releasePresaves.userId, userId)));
}

/** Пресейв гостя по email (идемпотентно). */
export async function presaveForGuest(email: string, releaseId: string): Promise<void> {
  await db
    .insert(releasePresaves)
    .values({ releaseId, email })
    .onConflictDoNothing({ target: [releasePresaves.releaseId, releasePresaves.email] });
}

export async function getPresaveState(userId: string, releaseId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: releasePresaves.id })
    .from(releasePresaves)
    .where(and(eq(releasePresaves.releaseId, releaseId), eq(releasePresaves.userId, userId)))
    .limit(1);
  return !!row;
}

/** Множество releaseId (из списка), которые юзер уже пресейвнул: один запрос. */
export async function getPresaveStates(userId: string, releaseIds: string[]): Promise<Set<string>> {
  if (releaseIds.length === 0) return new Set();
  const rows = await db
    .select({ releaseId: releasePresaves.releaseId })
    .from(releasePresaves)
    .where(and(eq(releasePresaves.userId, userId), inArray(releasePresaves.releaseId, releaseIds)));
  return new Set(rows.map((r) => r.releaseId));
}

/** Отписка гостя: удаляет ещё не исполненные гостевые пресейвы этого email по всем
 *  релизам. Уже исполненные (fulfilledAt не NULL) не трогаем: письмо по ним уже ушло. */
export async function deletePendingGuestPresavesByEmail(email: string): Promise<number> {
  const res = await db
    .delete(releasePresaves)
    .where(and(eq(releasePresaves.email, email), isNull(releasePresaves.fulfilledAt)))
    .returning({ id: releasePresaves.id });
  return res.length;
}

export async function getPresaveCount(releaseId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(releasePresaves)
    .where(eq(releasePresaves.releaseId, releaseId));
  return row?.count ?? 0;
}

export interface ReleasePresaveInfo {
  id: string;
  artistProfileId: string;
  status: string;
  releaseDate: Date | null;
}

/** Статус и дата релиза: чтобы решить, можно ли пресейвить (SCHEDULED + будущее). */
export async function getReleasePresaveInfo(releaseId: string): Promise<ReleasePresaveInfo | null> {
  const [row] = await db
    .select({
      id: releases.id,
      artistProfileId: releases.artistProfileId,
      status: releases.status,
      releaseDate: releases.releaseDate,
    })
    .from(releases)
    .where(eq(releases.id, releaseId))
    .limit(1);
  return row ?? null;
}

export interface DueRelease {
  id: string;
  title: string;
  type: string;
  coverUrl: string | null;
  releaseDate: Date | null;
  artistProfileId: string;
  artistName: string;
  artistSlug: string;
}

/** SCHEDULED-релизы, у которых наступила дата выхода: кандидаты на публикацию. */
export async function findDueScheduledReleases(): Promise<DueRelease[]> {
  return db
    .select({
      id: releases.id,
      title: releases.title,
      type: releases.type,
      coverUrl: releases.coverUrl,
      releaseDate: releases.releaseDate,
      artistProfileId: releases.artistProfileId,
      artistName: artistProfiles.name,
      artistSlug: artistProfiles.slug,
    })
    .from(releases)
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(
      and(
        eq(releases.status, 'SCHEDULED'),
        isNotNull(releases.releaseDate),
        lte(releases.releaseDate, sql`now()`),
      ),
    );
}

/** Атомарно публикует релиз только если он ещё SCHEDULED: гонка двух прогонов
 *  планировщика приведёт лишь к одному true (второй апдейт не заматчит строку). */
export async function publishScheduledRelease(releaseId: string): Promise<boolean> {
  const res = await db
    .update(releases)
    .set({ status: 'PUBLISHED', publishedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(releases.id, releaseId), eq(releases.status, 'SCHEDULED')))
    .returning({ id: releases.id });
  return res.length > 0;
}

/** userId всех неисполненных пресейверов релиза: для авто-лайка. */
export async function getPresaverUserIds(releaseId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: releasePresaves.userId })
    .from(releasePresaves)
    .where(
      and(
        eq(releasePresaves.releaseId, releaseId),
        isNotNull(releasePresaves.userId),
        isNull(releasePresaves.fulfilledAt),
      ),
    );
  return rows.map((r) => r.userId).filter((id): id is string => id !== null);
}

export interface PresaverContact {
  email: string;
  name: string | null;
  locale: string | null;
  // Ссылка «отписаться» в письме удаляет только гостевые пресейвы по email:
  // юзеру её не показываем, его presave живёт при userId, а не при email.
  isGuest: boolean;
}

/** Email-контакты неисполненных пресейверов: юзеры (через users) + гости (email-колонка). */
export async function getPresaverContacts(releaseId: string): Promise<PresaverContact[]> {
  const rows = await db
    .select({
      userId: releasePresaves.userId,
      guestEmail: releasePresaves.email,
      userEmail: users.email,
      userName: users.name,
      userLocale: users.locale,
    })
    .from(releasePresaves)
    .leftJoin(users, eq(users.id, releasePresaves.userId))
    .where(and(eq(releasePresaves.releaseId, releaseId), isNull(releasePresaves.fulfilledAt)));

  return rows
    .map((r) => ({
      email: r.userId ? r.userEmail : r.guestEmail,
      name: r.userName ?? null,
      locale: r.userLocale ?? null,
      isGuest: r.userId === null,
    }))
    .filter((r): r is PresaverContact => r.email !== null);
}

/** READY-треки релиза: для авто-лайка пресейверам. */
export async function getReadyTrackIds(releaseId: string): Promise<string[]> {
  const rows = await db
    .select({ id: tracks.id })
    .from(tracks)
    .where(and(eq(tracks.releaseId, releaseId), eq(tracks.status, 'READY')));
  return rows.map((r) => r.id);
}

/** Массовый лайк (юзеры × треки), идемпотентно: авто-добавление в «Лайки». */
export async function bulkLikeTracks(userIds: string[], trackIds: string[]): Promise<void> {
  if (userIds.length === 0 || trackIds.length === 0) return;
  const values = userIds.flatMap((userId) => trackIds.map((trackId) => ({ userId, trackId })));
  await db.insert(likes).values(values).onConflictDoNothing();
}

export async function markPresavesFulfilled(releaseId: string): Promise<void> {
  await db
    .update(releasePresaves)
    .set({ fulfilledAt: new Date() })
    .where(and(eq(releasePresaves.releaseId, releaseId), isNull(releasePresaves.fulfilledAt)));
}
