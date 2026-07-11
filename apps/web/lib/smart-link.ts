// Чистые хелперы валидации smart-link — без Next/DB, тестируются изолированно.
import type { ArtistLink } from '@vire/core';

export const MAX_SMART_LINKS = 20; // ссылок на площадки в одном лендинге
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Приводит строку к slug: латиница/цифры/дефис, нижний регистр. */
export function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function isValidSlug(slug: string): boolean {
  return slug.length >= 1 && slug.length <= 60 && SLUG_RE.test(slug);
}

/** Парсит массив ссылок из JSON-строки формы: валидный http(s)-URL, обрезанные подписи, ограничение количества. */
export function parseSmartLinkLinks(raw: unknown, max = MAX_SMART_LINKS): ArtistLink[] {
  if (typeof raw !== 'string') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: ArtistLink[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const url = (item as { url?: unknown }).url;
    const label = (item as { label?: unknown }).label;
    if (typeof url !== 'string' || !isHttpUrl(url)) continue;
    const link: ArtistLink = { url: url.trim() };
    if (typeof label === 'string' && label.trim()) link.label = label.trim().slice(0, 60);
    out.push(link);
    if (out.length >= max) break;
  }
  return out;
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
