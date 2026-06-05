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

export interface ArtistProfile {
  id: string;
  userId: string;
  slug: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  themeTokens: ThemeTokens;
  verified: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
