import { desc, eq } from 'drizzle-orm';
import { db } from '../client';
import { artistPosts } from '../schema';
import type { ArtistPost } from '@vire/core';

export type { ArtistPost };

// Владение (пост принадлежит профилю) проверяется в роут-хендлере, не здесь.

function mapPost(row: typeof artistPosts.$inferSelect): ArtistPost {
  return {
    id: row.id,
    artistProfileId: row.artistProfileId,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listArtistPosts(
  artistProfileId: string,
  limit = 50,
): Promise<ArtistPost[]> {
  const rows = await db
    .select()
    .from(artistPosts)
    .where(eq(artistPosts.artistProfileId, artistProfileId))
    .orderBy(desc(artistPosts.createdAt))
    .limit(limit);
  return rows.map(mapPost);
}

export async function getArtistPostById(id: string): Promise<ArtistPost | null> {
  const [row] = await db.select().from(artistPosts).where(eq(artistPosts.id, id)).limit(1);
  return row ? mapPost(row) : null;
}

export async function createArtistPost(data: {
  artistProfileId: string;
  title: string | null;
  body: string;
}): Promise<ArtistPost> {
  const [row] = await db.insert(artistPosts).values(data).returning();
  return mapPost(row);
}

export async function updateArtistPost(
  id: string,
  data: { title: string | null; body: string },
): Promise<void> {
  await db
    .update(artistPosts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(artistPosts.id, id));
}

export async function deleteArtistPost(id: string): Promise<void> {
  await db.delete(artistPosts).where(eq(artistPosts.id, id));
}
