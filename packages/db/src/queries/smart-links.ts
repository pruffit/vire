import { and, desc, eq, ne } from 'drizzle-orm';
import { db } from '../client';
import { smartLinks, releases } from '../schema';
import { isUuid } from '@vire/core';
import type { SmartLink, ArtistLink } from '@vire/core';

type SmartLinkRow = typeof smartLinks.$inferSelect;

function toSmartLink(row: SmartLinkRow): SmartLink {
  return {
    id: row.id,
    artistProfileId: row.artistProfileId,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    coverUrl: row.coverUrl,
    releaseDate: row.releaseDate,
    releaseId: row.releaseId,
    links: (row.links ?? []) as ArtistLink[],
    isPublished: row.isPublished,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Один лендинг по (артист, slug) — для публичной страницы и редактора. */
export async function getSmartLinkBySlug(artistProfileId: string, slug: string): Promise<SmartLink | null> {
  const [row] = await db
    .select()
    .from(smartLinks)
    .where(and(eq(smartLinks.artistProfileId, artistProfileId), eq(smartLinks.slug, slug)))
    .limit(1);
  return row ? toSmartLink(row) : null;
}

/**
 * Минимум о привязанном релизе для лендинга: статус/дата (для выбора CTA
 * «Слушать»/«Пресейв») + обложка/название/дата как фолбэк отображения.
 */
export interface SmartLinkRelease {
  id: string;
  title: string;
  coverUrl: string | null;
  releaseDate: Date | null;
  status: string;
}

export async function getSmartLinkRelease(releaseId: string): Promise<SmartLinkRelease | null> {
  if (!isUuid(releaseId)) return null;
  const [row] = await db
    .select({
      id: releases.id,
      title: releases.title,
      coverUrl: releases.coverUrl,
      releaseDate: releases.releaseDate,
      status: releases.status,
    })
    .from(releases)
    .where(eq(releases.id, releaseId))
    .limit(1);
  return row ?? null;
}

/** Опции релизов артиста для дропдауна привязки смартлинка (любой статус). */
export interface ReleaseOption {
  id: string;
  title: string;
  status: string;
}

export async function getReleaseOptions(artistProfileId: string): Promise<ReleaseOption[]> {
  return db
    .select({ id: releases.id, title: releases.title, status: releases.status })
    .from(releases)
    .where(eq(releases.artistProfileId, artistProfileId))
    .orderBy(desc(releases.createdAt));
}

export async function getSmartLinkById(id: string): Promise<SmartLink | null> {
  const [row] = await db.select().from(smartLinks).where(eq(smartLinks.id, id)).limit(1);
  return row ? toSmartLink(row) : null;
}

/** Опубликованные лендинги артиста — для карточки-хаба. */
export async function getPublishedSmartLinks(artistProfileId: string): Promise<SmartLink[]> {
  const rows = await db
    .select()
    .from(smartLinks)
    .where(and(eq(smartLinks.artistProfileId, artistProfileId), eq(smartLinks.isPublished, true)))
    .orderBy(desc(smartLinks.releaseDate), desc(smartLinks.createdAt));
  return rows.map(toSmartLink);
}

/** Все лендинги артиста (включая черновики) — для дашборда. */
export async function listSmartLinks(artistProfileId: string): Promise<SmartLink[]> {
  const rows = await db
    .select()
    .from(smartLinks)
    .where(eq(smartLinks.artistProfileId, artistProfileId))
    .orderBy(desc(smartLinks.updatedAt));
  return rows.map(toSmartLink);
}

/** Свободен ли slug у артиста (кроме указанного id — для редактирования). */
export async function smartLinkSlugTaken(artistProfileId: string, slug: string, exceptId?: string): Promise<boolean> {
  const rows = await db
    .select({ id: smartLinks.id })
    .from(smartLinks)
    .where(and(
      eq(smartLinks.artistProfileId, artistProfileId),
      eq(smartLinks.slug, slug),
      exceptId ? ne(smartLinks.id, exceptId) : undefined,
    ))
    .limit(1);
  return rows.length > 0;
}

export interface SmartLinkInput {
  slug: string;
  title: string;
  subtitle?: string | null;
  coverUrl?: string | null;
  releaseDate?: Date | null;
  releaseId?: string | null;
  links: ArtistLink[];
  isPublished: boolean;
}

export async function createSmartLink(artistProfileId: string, input: SmartLinkInput): Promise<string> {
  const [row] = await db
    .insert(smartLinks)
    .values({
      artistProfileId,
      slug: input.slug,
      title: input.title,
      subtitle: input.subtitle ?? null,
      coverUrl: input.coverUrl ?? null,
      releaseDate: input.releaseDate ?? null,
      releaseId: input.releaseId ?? null,
      links: input.links,
      isPublished: input.isPublished,
    })
    .returning({ id: smartLinks.id });
  return row.id;
}

/** Обновляет лендинг с проверкой владения (artistProfileId). coverUrl: undefined — не трогаем. */
export async function updateSmartLink(
  id: string,
  artistProfileId: string,
  input: Partial<SmartLinkInput>,
): Promise<boolean> {
  const patch: Partial<typeof smartLinks.$inferInsert> = { updatedAt: new Date() };
  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.title !== undefined) patch.title = input.title;
  if (input.subtitle !== undefined) patch.subtitle = input.subtitle;
  if (input.coverUrl !== undefined) patch.coverUrl = input.coverUrl;
  if (input.releaseDate !== undefined) patch.releaseDate = input.releaseDate;
  if (input.releaseId !== undefined) patch.releaseId = input.releaseId;
  if (input.links !== undefined) patch.links = input.links;
  if (input.isPublished !== undefined) patch.isPublished = input.isPublished;

  const result = await db
    .update(smartLinks)
    .set(patch)
    .where(and(eq(smartLinks.id, id), eq(smartLinks.artistProfileId, artistProfileId)))
    .returning({ id: smartLinks.id });
  return result.length > 0;
}

export async function deleteSmartLink(id: string, artistProfileId: string): Promise<boolean> {
  const result = await db
    .delete(smartLinks)
    .where(and(eq(smartLinks.id, id), eq(smartLinks.artistProfileId, artistProfileId)))
    .returning({ id: smartLinks.id });
  return result.length > 0;
}
