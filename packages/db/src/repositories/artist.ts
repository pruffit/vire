import { and, eq } from 'drizzle-orm';
import { artistProfiles } from '../schema';
import type { DB } from '../client';
import type { IArtistRepository, ArtistProfile, ThemeTokens } from '@vire/core';
import { defaultThemeTokens } from '@vire/core';

export class DrizzleArtistRepository implements IArtistRepository {
  constructor(private readonly db: DB) {}

  async findBySlug(slug: string): Promise<ArtistProfile | null> {
    const [row] = await this.db
      .select()
      .from(artistProfiles)
      .where(and(eq(artistProfiles.slug, slug), eq(artistProfiles.isActive, true)))
      .limit(1);

    if (!row) return null;
    return mapToArtistProfile(row);
  }

  async findByUserId(userId: string): Promise<ArtistProfile | null> {
    const [row] = await this.db
      .select()
      .from(artistProfiles)
      .where(eq(artistProfiles.userId, userId))
      .limit(1);

    if (!row) return null;
    return mapToArtistProfile(row);
  }
}

function mapToArtistProfile(row: typeof artistProfiles.$inferSelect): ArtistProfile {
  return {
    id: row.id,
    userId: row.userId,
    slug: row.slug,
    name: row.name,
    bio: row.bio,
    avatarUrl: row.avatarUrl,
    themeTokens: (row.themeTokens as ThemeTokens) ?? defaultThemeTokens,
    verified: row.verified,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
