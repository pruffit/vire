import type { GenreCount } from '@vire/db';
import type { Mood } from '@/lib/moods';
import { GENRE_GROUPS } from '@/lib/genres';

export interface MoodChip {
  mood: Mood;
  count: number;
}

export interface WaveChipItem {
  key: string;
  label: string;
  kind: 'mood' | 'genre';
}

export interface TagSheetItem extends WaveChipItem {
  count: number;
}

export interface TagSheetSection {
  label: string;
  items: TagSheetItem[];
}

export interface TagLabelTranslators {
  moodLabel: (mood: Mood) => string;
  genreLabel: (genre: GenreCount['genre']) => string;
  groupLabel: (group: (typeof GENRE_GROUPS)[number]) => string;
}

/** Все чипы волны: mood и genre вперемешку по убыванию count, без ограничения — ряд листается ScrollRow. */
export function waveChips(moods: MoodChip[], genres: GenreCount[], t: TagLabelTranslators): WaveChipItem[] {
  const all: { item: WaveChipItem; count: number }[] = [
    ...moods.map(({ mood, count }) => ({ item: { key: mood, label: t.moodLabel(mood), kind: 'mood' as const }, count })),
    ...genres.map(({ genre, count }) => ({ item: { key: genre, label: t.genreLabel(genre), kind: 'genre' as const }, count })),
  ];
  all.sort((a, b) => b.count - a.count || a.item.label.localeCompare(b.item.label));
  // лейблы mood и genre пересекаются («Эмбиент») — два одинаковых чипа выглядят дублем; сортировка выше уже отдала приоритет большему count
  const seenLabels = new Set<string>();
  const result: WaveChipItem[] = [];
  for (const { item } of all) {
    if (seenLabels.has(item.label)) continue;
    seenLabels.add(item.label);
    result.push(item);
  }
  return result;
}

export function groupTagsForSheet(
  moods: MoodChip[],
  genres: GenreCount[],
  t: TagLabelTranslators,
  moodsHeading: string,
): TagSheetSection[] {
  const byCountDesc = (a: TagSheetItem, b: TagSheetItem) => b.count - a.count || a.label.localeCompare(b.label);

  const moodItems = moods
    .filter((m) => m.count > 0)
    .map(({ mood, count }): TagSheetItem => ({ key: mood, label: t.moodLabel(mood), kind: 'mood', count }))
    .sort(byCountDesc);

  const genreCounts = new Map(genres.map((g) => [g.genre, g.count]));

  const genreSections: TagSheetSection[] = GENRE_GROUPS.map((group) => ({
    label: t.groupLabel(group),
    items: group.genres
      .map((genre): TagSheetItem => ({ key: genre, label: t.genreLabel(genre), kind: 'genre', count: genreCounts.get(genre) ?? 0 }))
      .filter((item) => item.count > 0)
      .sort(byCountDesc),
  })).filter((section) => section.items.length > 0);

  const sections: TagSheetSection[] = [];
  if (moodItems.length > 0) sections.push({ label: moodsHeading, items: moodItems });
  sections.push(...genreSections);
  return sections;
}

export function filterTagSections(sections: TagSheetSection[], query: string): TagSheetSection[] {
  const q = query.trim().toLowerCase();
  if (!q) return sections;
  return sections
    .map((section) => ({ ...section, items: section.items.filter((item) => item.label.toLowerCase().includes(q)) }))
    .filter((section) => section.items.length > 0);
}
