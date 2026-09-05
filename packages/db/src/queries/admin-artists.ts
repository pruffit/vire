import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '../client';
import { users, artistProfiles, artistMembers, releases, tracks, playEvents, follows, rightsHolders } from '../schema';
import { defaultThemeTokens, type ThemeTokens } from '@vire/core';

// Артисты в бэкофисе: список с метриками, верификация, скрытие с витрины,
// правка профиля, состав участников и заведение артиста по email.

export interface AdminArtist {
  id: string;
  name: string;
  slug: string;
  verified: boolean;
  isActive: boolean;
  createdAt: Date;
  followerCount: number;
  releaseCount: number;
  trackCount: number;
  plays30d: number;
}

// 4 предагрегированных LEFT JOIN вместо N коррелированных подзапросов на N строк.
// Имена count-колонок разные в каждом (не «cnt» везде): иначе interpolated-колонка
// в sql-шаблоне ниже теряет квалификацию таблицы, и Postgres не различает четыре «cnt».
const artistFollowerAgg = db
  .select({ artistProfileId: follows.artistProfileId, followerCnt: sql<number>`count(*)`.as('follower_cnt') })
  .from(follows)
  .groupBy(follows.artistProfileId)
  .as('artist_follower_agg');

const artistReleaseAgg = db
  .select({ artistProfileId: releases.artistProfileId, releaseCnt: sql<number>`count(*)`.as('release_cnt') })
  .from(releases)
  .groupBy(releases.artistProfileId)
  .as('artist_release_agg');

const artistTrackAgg = db
  .select({ artistProfileId: releases.artistProfileId, trackCnt: sql<number>`count(*)`.as('track_cnt') })
  .from(tracks)
  .innerJoin(releases, eq(releases.id, tracks.releaseId))
  .groupBy(releases.artistProfileId)
  .as('artist_track_agg');

const artistPlays30dAgg = db
  .select({ artistProfileId: releases.artistProfileId, playsCnt: sql<number>`count(*)`.as('plays_cnt') })
  .from(playEvents)
  .innerJoin(tracks, eq(tracks.id, playEvents.trackId))
  .innerJoin(releases, eq(releases.id, tracks.releaseId))
  .where(sql`${playEvents.startedAt} >= now() - interval '30 days'`)
  .groupBy(releases.artistProfileId)
  .as('artist_plays30d_agg');

export async function listArtistsAdmin(opts: { search?: string; limit?: number; offset?: number } = {}): Promise<AdminArtist[]> {
  const { search, limit = 50, offset = 0 } = opts;
  const rows = await db
    .select({
      id: artistProfiles.id,
      name: artistProfiles.name,
      slug: artistProfiles.slug,
      verified: artistProfiles.verified,
      isActive: artistProfiles.isActive,
      createdAt: artistProfiles.createdAt,
      followerCount: sql<number>`coalesce(${artistFollowerAgg.followerCnt}, 0)::int`,
      releaseCount: sql<number>`coalesce(${artistReleaseAgg.releaseCnt}, 0)::int`,
      trackCount: sql<number>`coalesce(${artistTrackAgg.trackCnt}, 0)::int`,
      plays30d: sql<number>`coalesce(${artistPlays30dAgg.playsCnt}, 0)::int`,
    })
    .from(artistProfiles)
    .leftJoin(artistFollowerAgg, eq(artistFollowerAgg.artistProfileId, artistProfiles.id))
    .leftJoin(artistReleaseAgg, eq(artistReleaseAgg.artistProfileId, artistProfiles.id))
    .leftJoin(artistTrackAgg, eq(artistTrackAgg.artistProfileId, artistProfiles.id))
    .leftJoin(artistPlays30dAgg, eq(artistPlays30dAgg.artistProfileId, artistProfiles.id))
    .where(
      search
        ? or(ilike(artistProfiles.name, `%${search}%`), ilike(artistProfiles.slug, `%${search}%`))
        : undefined,
    )
    .orderBy(desc(artistProfiles.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map((r) => ({
    ...r,
    followerCount: Number(r.followerCount),
    releaseCount: Number(r.releaseCount),
    trackCount: Number(r.trackCount),
    plays30d: Number(r.plays30d),
  }));
}

/** Скрыть/показать артиста на витрине (isActive фильтруется во всех публичных запросах). */
export async function setArtistActive(artistProfileId: string, isActive: boolean): Promise<void> {
  await db
    .update(artistProfiles)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(artistProfiles.id, artistProfileId));
}

export async function getArtistCore(
  id: string,
): Promise<{ id: string; name: string; slug: string; bio: string | null; avatarUrl: string | null; themeTokens: ThemeTokens } | null> {
  const [row] = await db
    .select({
      id: artistProfiles.id,
      name: artistProfiles.name,
      slug: artistProfiles.slug,
      bio: artistProfiles.bio,
      avatarUrl: artistProfiles.avatarUrl,
      themeTokens: artistProfiles.themeTokens,
    })
    .from(artistProfiles)
    .where(eq(artistProfiles.id, id))
    .limit(1);
  if (!row) return null;
  return { ...row, themeTokens: (row.themeTokens as ThemeTokens | null) ?? defaultThemeTokens };
}

/** Полная админ-редактура профиля артиста, включая slug (он уникален → ловим конфликт). */
export async function adminUpdateArtist(
  id: string,
  data: { name: string; slug: string; bio: string | null; avatarUrl: string | null; themeTokens?: ThemeTokens },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await db
      .update(artistProfiles)
      .set({
        name: data.name,
        slug: data.slug,
        bio: data.bio,
        avatarUrl: data.avatarUrl,
        updatedAt: new Date(),
        ...(data.themeTokens ? { themeTokens: data.themeTokens } : {}),
      })
      .where(eq(artistProfiles.id, id));
    return { ok: true };
  } catch {
    return { ok: false, error: 'Не удалось сохранить — возможно, slug уже занят' };
  }
}


export async function verifyArtist(artistProfileId: string, verified: boolean): Promise<void> {
  await db
    .update(artistProfiles)
    .set({ verified, updatedAt: new Date() })
    .where(eq(artistProfiles.id, artistProfileId));
}


export async function createArtistForUser(data: {
  email: string;
  name: string;
  slug: string;
}): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const [user] = await db.select().from(users).where(eq(users.email, data.email)).limit(1);
  if (!user) return { ok: false, error: 'Пользователь не найден' };

  // Несколько артистов на один аккаунт разрешены: один человек может управлять
  // несколькими карточками. Уникален только slug (глобально).
  const [slugTaken] = await db.select({ id: artistProfiles.id })
    .from(artistProfiles).where(eq(artistProfiles.slug, data.slug)).limit(1);
  if (slugTaken) return { ok: false, error: `Slug @${data.slug} уже занят` };

  await db.transaction(async (tx) => {
    await tx.insert(rightsHolders).values({ userId: user.id, displayName: data.name });
    const [profile] = await tx.insert(artistProfiles).values({
      userId: user.id,
      slug: data.slug,
      name: data.name,
      isActive: true,
      verified: false,
    }).returning({ id: artistProfiles.id });
    // Создатель добавляется как OWNER-участник: контроль доступа к дашборду идёт через artist_members.
    await tx.insert(artistMembers).values({
      artistProfileId: profile.id,
      userId: user.id,
      role: 'OWNER',
    });
    if (user.role === 'LISTENER') {
      await tx.update(users).set({ role: 'ARTIST', updatedAt: new Date() }).where(eq(users.id, user.id));
    }
  });

  return { ok: true, slug: data.slug };
}

export interface ArtistMemberRow {
  userId: string;
  email: string | null;
  name: string | null;
  role: string;
  createdAt: Date;
}

export async function listArtistMembers(artistProfileId: string): Promise<ArtistMemberRow[]> {
  return db
    .select({
      userId: artistMembers.userId,
      email: users.email,
      name: users.name,
      role: artistMembers.role,
      createdAt: artistMembers.createdAt,
    })
    .from(artistMembers)
    .innerJoin(users, eq(users.id, artistMembers.userId))
    .where(eq(artistMembers.artistProfileId, artistProfileId))
    // OWNER сверху, далее по дате добавления.
    .orderBy(desc(eq(artistMembers.role, 'OWNER')), asc(artistMembers.createdAt));
}

/** Привязывает существующий аккаунт (по email) к профилю как MEMBER. Идемпотентно по уникальности. */
export async function addArtistMember(
  artistProfileId: string,
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [user] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
  if (!user) return { ok: false, error: 'Пользователь с таким email не найден' };

  const [existing] = await db
    .select({ id: artistMembers.id })
    .from(artistMembers)
    .where(and(eq(artistMembers.artistProfileId, artistProfileId), eq(artistMembers.userId, user.id)))
    .limit(1);
  if (existing) return { ok: false, error: 'Этот аккаунт уже участник' };

  await db.transaction(async (tx) => {
    await tx.insert(artistMembers).values({ artistProfileId, userId: user.id, role: 'MEMBER' });
    // Доступ к дашборду требует роли ARTIST; обычного слушателя повышаем (как в createArtistForUser).
    if (user.role === 'LISTENER') {
      await tx.update(users).set({ role: 'ARTIST', updatedAt: new Date() }).where(eq(users.id, user.id));
    }
  });
  return { ok: true };
}

/** Снимает участника. OWNER удалить нельзя (профиль не должен остаться без владельца). */
export async function removeArtistMember(
  artistProfileId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [m] = await db
    .select({ role: artistMembers.role })
    .from(artistMembers)
    .where(and(eq(artistMembers.artistProfileId, artistProfileId), eq(artistMembers.userId, userId)))
    .limit(1);
  if (!m) return { ok: false, error: 'Не участник' };
  if (m.role === 'OWNER') return { ok: false, error: 'Нельзя удалить владельца' };

  await db
    .delete(artistMembers)
    .where(and(eq(artistMembers.artistProfileId, artistProfileId), eq(artistMembers.userId, userId)));
  return { ok: true };
}
