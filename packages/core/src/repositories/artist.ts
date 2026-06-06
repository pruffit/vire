import type { ArtistProfile, ThemeTokens, ArtistLink } from '../types/artist';

export interface UpdateArtistProfileData {
  name?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  themeTokens?: ThemeTokens;
  links?: ArtistLink[];
}

export interface IArtistRepository {
  findBySlug(slug: string): Promise<ArtistProfile | null>;
  findByUserId(userId: string): Promise<ArtistProfile | null>;
  update(id: string, data: UpdateArtistProfileData): Promise<void>;
}
