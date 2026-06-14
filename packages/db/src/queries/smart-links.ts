import { and, desc, eq, ne } from 'drizzle-orm';
import { db } from '../client';
import { smartLinks } from '../schema';
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
