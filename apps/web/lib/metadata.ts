import type { Metadata } from 'next';
import { LOCALES, DEFAULT_LOCALE, localizedPath, type Locale } from '@vire/i18n/config';
import { SITE_NAME, DEFAULT_OG_IMAGE_PATH, applyTitleTemplate, siteLocale } from './site';

type OpenGraph = NonNullable<Metadata['openGraph']>;
type PageOgType = 'website' | 'profile' | 'music.album' | 'music.song' | 'music.playlist';

export interface OgImage {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
}

interface PageMetadataInput {
  url: string;
  title: string;
  description: string;
  locale: Locale;
  type?: PageOgType;
  /** null → ключ не проставляется: у сегмента свой opengraph-image.tsx (Next мёржит
   * файловую картинку только для точного сегмента, не для предков). */
  images?: OgImage[] | null;
}

const DEFAULT_IMAGES: OgImage[] = [{ url: DEFAULT_OG_IMAGE_PATH, width: 1200, height: 630 }];

/** canonical + hreflang alternates (ru/en/x-default) для страницы с относительным путём url —
 *  as-needed: ru без префикса, x-default указывает на ту же дефолтную локаль. Отдельно
 *  экспортируется для страниц, которым не подходит полный openGraph из pageMetadata
 *  (например главная — наследует og от корневого layout, см. app/[locale]/(listener)/(home)/page.tsx). */
export function localizedAlternates(locale: Locale, url: string): NonNullable<Metadata['alternates']> {
  const canonical = localizedPath(locale, url);
  const languages: Record<string, string> = { 'x-default': localizedPath(DEFAULT_LOCALE, url) };
  for (const l of LOCALES) languages[l] = localizedPath(l, url);
  return { canonical, languages };
}

// Next мёржит метаданные поверхностно: свой openGraph заменяет родительский целиком
// (siteName/locale/файловая картинка теряются) — проставляем их здесь явно.
export function pageMetadata({ url, title, description, locale, type = 'website', images }: PageMetadataInput): Metadata {
  const ogTitle = applyTitleTemplate(title);
  const resolvedImages = images === null ? undefined : (images ?? DEFAULT_IMAGES);
  const alternates = localizedAlternates(locale, url);

  return {
    title,
    description,
    alternates,
    openGraph: {
      type,
      siteName: SITE_NAME,
      locale: siteLocale(locale),
      url: alternates.canonical as string,
      title: ogTitle,
      description,
      ...(resolvedImages ? { images: resolvedImages } : {}),
    } as OpenGraph,
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description,
    },
  };
}
