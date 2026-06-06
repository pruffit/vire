import type { ArtistProfile, ThemeTokens, ArtistLink, ArtistVideo } from '../types/artist';

export interface UpdateArtistProfileData {
  name?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  themeTokens?: ThemeTokens;
  links?: ArtistLink[];
  videos?: ArtistVideo[];
}

export interface IArtistRepository {
  findBySlug(slug: string): Promise<ArtistProfile | null>;
  findByUserId(userId: string): Promise<ArtistProfile | null>;
  update(id: string, data: UpdateArtistProfileData): Promise<void>;
}
