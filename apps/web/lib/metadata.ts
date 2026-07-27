import type { Metadata } from 'next';
import { SITE_NAME, SITE_LOCALE, DEFAULT_OG_IMAGE_PATH, applyTitleTemplate } from './site';

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
  type?: PageOgType;
  /** null → ключ не проставляется: у сегмента свой opengraph-image.tsx (Next мёржит
   * файловую картинку только для точного сегмента, не для предков). */
  images?: OgImage[] | null;
}

const DEFAULT_IMAGES: OgImage[] = [{ url: DEFAULT_OG_IMAGE_PATH, width: 1200, height: 630 }];

// Next мёржит метаданные поверхностно: свой openGraph заменяет родительский целиком
// (siteName/locale/файловая картинка теряются) — проставляем их здесь явно.
export function pageMetadata({ url, title, description, type = 'website', images }: PageMetadataInput): Metadata {
  const ogTitle = applyTitleTemplate(title);
  const resolvedImages = images === null ? undefined : (images ?? DEFAULT_IMAGES);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      url,
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
