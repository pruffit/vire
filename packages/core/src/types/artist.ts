export interface ThemeTokens {
  bg: string;
  text: string;
  accent: string;
  grain: boolean;
  fontSans: string;
  fontMono: string;
}

export const defaultThemeTokens: ThemeTokens = {
  bg: '#121110',
  text: '#f5f2eb',
  accent: '#4a5568',
  grain: true,
  fontSans: 'Inter',
  fontMono: 'JetBrains Mono',
};

export interface ArtistLink {
  url: string;
  /** Необязательная подпись. Если пусто — площадка/название берётся из URL (detectPlatform). */
  label?: string;
}

/** Smart-link лендинг (bandlink): страница релиза со ссылками на стриминги/соцсети, без загрузки в Vire. */
export interface SmartLink {
  id: string;
  artistProfileId: string;
  slug: string;
  title: string;
  subtitle: string | null;
  coverUrl: string | null;
  releaseDate: Date | null;
  /** Привязка к релизу Vire (опц.) — даёт кнопку «Слушать/Пресейв на Vire». */
  releaseId: string | null;
  links: ArtistLink[];
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ArtistVideo {
  url: string;
  title: string;
}

export interface ArtistProfile {
  id: string;
  userId: string;
  slug: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  headerUrl: string | null;
  themeTokens: ThemeTokens;
  links: ArtistLink[];
  videos: ArtistVideo[];
  verified: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
