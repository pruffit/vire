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
  /** Первый (старейший) профиль артиста пользователя — дефолт при отсутствии выбора. */
  findByUserId(userId: string): Promise<ArtistProfile | null>;
  /** Все профили артиста пользователя (для переключателя в дашборде). */
  findAllByUserId(userId: string): Promise<ArtistProfile[]>;
  /** Профиль по id, но только если принадлежит пользователю (проверка владения). */
  findByIdForUser(artistId: string, userId: string): Promise<ArtistProfile | null>;
  update(id: string, data: UpdateArtistProfileData): Promise<void>;
}
