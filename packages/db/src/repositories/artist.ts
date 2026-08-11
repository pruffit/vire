import { and, asc, eq } from 'drizzle-orm';
import { artistProfiles, artistMembers } from '../schema';
import type { DB } from '../client';
import type { IArtistRepository, ArtistProfile, ThemeTokens, ArtistLink, ArtistVideo, UpdateArtistProfileData } from '@vire/core';
import { defaultThemeTokens } from '@vire/core';
import { adminUpdateArtist } from '../queries/admin';

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

  async findById(id: string): Promise<ArtistProfile | null> {
    const [row] = await this.db
      .select()
      .from(artistProfiles)
      .where(and(eq(artistProfiles.id, id), eq(artistProfiles.isActive, true)))
      .limit(1);

    if (!row) return null;
    return mapToArtistProfile(row);
  }

  // Доступ к дашборду = членство в artist_members (несколько аккаунтов на профиль).
  async findByUserId(userId: string): Promise<ArtistProfile | null> {
    const [row] = await this.db
      .select({ profile: artistProfiles })
      .from(artistProfiles)
      .innerJoin(artistMembers, eq(artistMembers.artistProfileId, artistProfiles.id))
      .where(eq(artistMembers.userId, userId))
      .orderBy(asc(artistProfiles.createdAt))
      .limit(1);

    if (!row) return null;
    return mapToArtistProfile(row.profile);
  }

  async findAllByUserId(userId: string): Promise<ArtistProfile[]> {
    const rows = await this.db
      .select({ profile: artistProfiles })
      .from(artistProfiles)
      .innerJoin(artistMembers, eq(artistMembers.artistProfileId, artistProfiles.id))
      .where(eq(artistMembers.userId, userId))
      .orderBy(asc(artistProfiles.createdAt));

    return rows.map((r) => mapToArtistProfile(r.profile));
  }

  async findByIdForUser(artistId: string, userId: string): Promise<ArtistProfile | null> {
    const [row] = await this.db
      .select({ profile: artistProfiles })
      .from(artistProfiles)
      .innerJoin(artistMembers, eq(artistMembers.artistProfileId, artistProfiles.id))
      .where(and(eq(artistProfiles.id, artistId), eq(artistMembers.userId, userId)))
      .limit(1);

    if (!row) return null;
    return mapToArtistProfile(row.profile);
  }

  async update(id: string, data: UpdateArtistProfileData): Promise<void> {
    await this.db
      .update(artistProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(artistProfiles.id, id));
  }

  adminUpdate(
    id: string,
    data: { name: string; slug: string; bio: string | null; avatarUrl: string | null; themeTokens?: ThemeTokens },
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    return adminUpdateArtist(id, data);
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
    headerUrl: row.headerUrl,
    themeTokens: (row.themeTokens as ThemeTokens) ?? defaultThemeTokens,
    links: Array.isArray(row.links) ? (row.links as ArtistLink[]) : [],
    videos: Array.isArray(row.videos) ? (row.videos as ArtistVideo[]) : [],
    verified: row.verified,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
