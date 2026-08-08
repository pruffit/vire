import type { Locale } from './config';

// Неймспейс = зона продукта (см. docs/superpowers/specs/2026-08-09-i18n-full-localization-design.md).
// Наполняются срезами A–H; в срезе 0 все файлы messages/{ru,en}/*.json пустые {}.
export const NAMESPACES = [
  'common',
  'nav',
  'player',
  'home',
  'catalog',
  'artist',
  'release',
  'track',
  'playlist',
  'library',
  'search',
  'profile',
  'social',
  'chat',
  'jam',
  'party',
  'auth',
  'dashboard',
  'legal',
  'faq',
  'moods',
  'genres',
  'platforms',
  'errors',
  'email',
  'seo',
  'pwa',
] as const;

export type Namespace = (typeof NAMESPACES)[number];

export type Messages = Record<Namespace, Record<string, unknown>>;

export async function getMessages(locale: Locale): Promise<Messages> {
  const entries = await Promise.all(
    NAMESPACES.map(async (namespace) => {
      const mod = (await import(`../messages/${locale}/${namespace}.json`)) as { default: Record<string, unknown> };
      return [namespace, mod.default] as const;
    }),
  );
  return Object.fromEntries(entries) as Messages;
}
