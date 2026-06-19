import { SITE_URL } from './site';

/**
 * Билдеры Schema.org JSON-LD для страниц артиста, релиза и трека.
 *
 * Цель из концепта: страница `/artists/[slug]` должна перебивать в выдаче
 * стриминги — для этого помимо OG-тегов поисковикам отдаются структурированные
 * данные (MusicGroup / MusicAlbum / MusicRecording). Чистые функции без эффектов,
 * чтобы покрыть тестами; рендерятся серверным компонентом <JsonLd>.
 */

export const abs = (path: string): string =>
  path.startsWith('http') ? path : `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;

/** Секунды → ISO-8601 длительность (PT3M21S). null/0/отрицательные → undefined. */
export function secondsToISO8601(sec: number | null | undefined): string | undefined {
  if (!sec || sec <= 0 || !Number.isFinite(sec)) return undefined;
  const total = Math.round(sec);
  if (total === 0) return undefined;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}${s ? `${s}S` : ''}`;
}

function yearOrDate(d: Date | string | null | undefined): string | undefined {
  if (!d) return undefined;
  const date = new Date(d);
  if (!Number.isFinite(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

export interface ArtistLd {
  name: string;
  slug: string;
  avatarUrl?: string | null;
  bio?: string | null;
  links?: { url: string; label?: string }[];
}

export interface ReleaseLd {
  id: string;
  title: string;
  coverUrl?: string | null;
  releaseDate?: Date | string | null;
  description?: string | null;
}

export interface TrackLd {
  id: string;
  title: string;
  trackNumber: number;
  durationSec?: number | null;
}

/** MusicGroup — страница артиста. sameAs из внешних ссылок (соцсети). */
export function musicGroupJsonLd(artist: ArtistLd): Record<string, unknown> {
  const url = abs(`/artists/${artist.slug}`);
  const sameAs = (artist.links ?? [])
    .map((l) => l.url)
    .filter((u) => /^https?:\/\//.test(u));

  return prune({
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    name: artist.name,
    url,
    image: artist.avatarUrl ? abs(artist.avatarUrl) : undefined,
    description: artist.bio || undefined,
    sameAs: sameAs.length > 0 ? sameAs : undefined,
  });
}

/** MusicAlbum — страница релиза, с вложенным byArtist и треками. */
export function musicAlbumJsonLd(
  release: ReleaseLd,
  artist: ArtistLd,
  tracks: TrackLd[],
): Record<string, unknown> {
  const artistUrl = abs(`/artists/${artist.slug}`);
  const albumUrl = abs(`/artists/${artist.slug}/releases/${release.id}`);

  return prune({
    '@context': 'https://schema.org',
    '@type': 'MusicAlbum',
    name: release.title,
    url: albumUrl,
    image: release.coverUrl ? abs(release.coverUrl) : undefined,
    datePublished: yearOrDate(release.releaseDate),
    description: release.description || undefined,
    numTracks: tracks.length || undefined,
    byArtist: {
      '@type': 'MusicGroup',
      name: artist.name,
      url: artistUrl,
    },
    track: tracks.length
      ? tracks.map((t) =>
          prune({
            '@type': 'MusicRecording',
            position: t.trackNumber,
            name: t.title,
            url: `${albumUrl}/tracks/${t.id}`,
            duration: secondsToISO8601(t.durationSec),
          }),
        )
      : undefined,
  });
}

/** MusicRecording — страница трека, с inAlbum и byArtist. */
export function musicRecordingJsonLd(
  track: TrackLd,
  release: ReleaseLd,
  artist: ArtistLd,
): Record<string, unknown> {
  const artistUrl = abs(`/artists/${artist.slug}`);
  const albumUrl = abs(`/artists/${artist.slug}/releases/${release.id}`);

  return prune({
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    name: track.title,
    url: `${albumUrl}/tracks/${track.id}`,
    duration: secondsToISO8601(track.durationSec),
    image: release.coverUrl ? abs(release.coverUrl) : undefined,
    byArtist: {
      '@type': 'MusicGroup',
      name: artist.name,
      url: artistUrl,
    },
    inAlbum: {
      '@type': 'MusicAlbum',
      name: release.title,
      url: albumUrl,
    },
  });
}

/** WebSite — главная страница платформы (для поисковых чекеров). */
export function websiteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Vire',
    url: SITE_URL,
    description: 'Независимая музыкальная площадка для артистов и слушателей СНГ',
  };
}

/** CollectionPage — страница каталога артистов. */
export function artistsCatalogJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Артисты — Vire',
    description: 'Все артисты на платформе Vire',
    url: abs('/artists'),
  };
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

/** BreadcrumbList — хлебные крошки для страниц артиста/релиза/трека. */
export function breadcrumbListJsonLd(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: abs(item.url),
    })),
  };
}

/** Убирает ключи со значением undefined (рекурсивно, для чистого JSON-LD). */
function prune<T extends Record<string, unknown>>(obj: T): T {
  for (const key of Object.keys(obj)) {
    if (obj[key] === undefined) delete obj[key];
  }
  return obj;
}
