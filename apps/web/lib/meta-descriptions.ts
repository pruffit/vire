import type { ReleaseType } from '@vire/core';
import { pluralRu } from './ru-plural';

const RELEASE_TYPE_LABELS: Record<ReleaseType, string> = {
  ALBUM: 'Альбом',
  EP: 'EP',
  SINGLE: 'Сингл',
};

export function releaseMetaDescription(input: {
  title: string;
  artistName: string;
  type?: ReleaseType;
  year?: number | null;
  trackCount?: number | null;
}): string {
  const { title, artistName, type, year, trackCount } = input;
  const kind = type ? RELEASE_TYPE_LABELS[type] : 'Релиз';
  const yearPart = year ? ` ${year} года` : '';
  const countPart = trackCount ? `, ${trackCount} ${pluralRu(trackCount, ['трек', 'трека', 'треков'])}` : '';
  return `${kind} «${title}»${yearPart} от ${artistName}${countPart}. Слушать на VireMusic.`;
}

export function trackMetaDescription(input: {
  trackTitle: string;
  releaseTitle: string;
  artistName: string;
  year?: number | null;
}): string {
  const { trackTitle, releaseTitle, artistName, year } = input;
  const yearPart = year ? ` (${year})` : '';
  return `«${trackTitle}» — трек ${artistName} из релиза «${releaseTitle}»${yearPart}. Слушать на VireMusic.`;
}
