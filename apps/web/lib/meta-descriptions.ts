import type { ReleaseType } from '@vire/core';
import type { Locale } from '@vire/i18n/config';
import { getTranslator } from '@vire/i18n/translator';

export async function releaseMetaDescription(input: {
  title: string;
  artistName: string;
  type?: ReleaseType;
  year?: number | null;
  trackCount?: number | null;
  locale: Locale;
}): Promise<string> {
  const { title, artistName, type, year, trackCount, locale } = input;
  const t = await getTranslator(locale);
  const kind = type ? t(`common.releaseType.${type}`) : t('seo.release.kindFallback');
  return t('seo.release.description', {
    kind,
    title,
    artistName,
    hasYear: year ? 'yes' : 'no',
    year: year ?? 0,
    hasCount: trackCount ? 'yes' : 'no',
    trackCount: trackCount ? t('common.trackCount', { count: trackCount }) : '',
  });
}

export async function trackMetaDescription(input: {
  trackTitle: string;
  releaseTitle: string;
  artistName: string;
  year?: number | null;
  locale: Locale;
}): Promise<string> {
  const { trackTitle, releaseTitle, artistName, year, locale } = input;
  const t = await getTranslator(locale);
  return t('seo.track.description', {
    trackTitle,
    releaseTitle,
    artistName,
    hasYear: year ? 'yes' : 'no',
    year: year ?? 0,
  });
}
