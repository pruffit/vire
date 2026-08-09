import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../client';
import { follows, users, tracks, releases, artistProfiles, notifications } from '../schema';
import type { NotificationType, NotificationItem } from '@vire/core';

export interface FollowerEmail {
  email: string;
  name: string | null;
  locale: string | null;
}

export async function getFollowerEmails(artistProfileId: string): Promise<FollowerEmail[]> {
  const rows = await db
    .select({ email: users.email, name: users.name, locale: users.locale })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.userId))
    .where(eq(follows.artistProfileId, artistProfileId));

  // Telegram-пользователи не имеют email, их пропускаем для рассылок
  return rows.filter((r): r is FollowerEmail => r.email !== null);
}

export interface TrackOwnerContact {
  email: string;
  name: string | null;
  trackTitle: string;
  releaseId: string;
  artistSlug: string;
}

// null, если у владельца нет email (теоретически невозможно для артиста, но защищаемся)
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

// «Колокольчик» в навигации — отдельный домен от email-рассылок выше, но тот же файл по имени таблицы.
export async function insertNotification(
  userId: string,
  type: NotificationType,
  actorId: string | null,
  entityId: string | null,
): Promise<void> {
  await db.insert(notifications).values({ userId, type, actorId, entityId });
}

export async function listNotifications(userId: string, limit: number): Promise<NotificationItem[]> {
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      actorId: notifications.actorId,
      actorName: users.name,
      actorImage: users.image,
      entityId: notifications.entityId,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .leftJoin(users, eq(users.id, notifications.actorId))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  return rows;
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return Number(row?.n ?? 0);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await db.update(notifications).set({ readAt: sql`now()` })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}

export async function markNotificationRead(userId: string, id: string): Promise<void> {
  await db.update(notifications).set({ readAt: sql`now()` })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}
