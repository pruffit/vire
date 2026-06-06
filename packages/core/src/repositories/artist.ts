import type { ArtistProfile, ThemeTokens } from '../types/artist';

export interface UpdateArtistProfileData {
  name?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  themeTokens?: ThemeTokens;
}

export interface IArtistRepository {
  findBySlug(slug: string): Promise<ArtistProfile | null>;
  findByUserId(userId: string): Promise<ArtistProfile | null>;
  update(id: string, data: UpdateArtistProfileData): Promise<void>;
}
