import type { GenreCount } from '@vire/db';
import { MOOD_LABELS, type Mood } from '@/lib/moods';
import { GENRE_LABELS, GENRE_GROUPS } from '@/lib/genres';

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

/** Все чипы волны: mood и genre вперемешку по убыванию count, без ограничения — ряд листается ScrollRow. */
export function waveChips(moods: MoodChip[], genres: GenreCount[]): WaveChipItem[] {
  const all: { item: WaveChipItem; count: number }[] = [
    ...moods.map(({ mood, count }) => ({ item: { key: mood, label: MOOD_LABELS[mood], kind: 'mood' as const }, count })),
    ...genres.map(({ genre, count }) => ({ item: { key: genre, label: GENRE_LABELS[genre], kind: 'genre' as const }, count })),
  ];
  all.sort((a, b) => b.count - a.count || a.item.label.localeCompare(b.item.label, 'ru'));
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

/** Секции для шита «Все теги»: Настроения + жанровые группы каталога, только теги с count > 0. */
export function groupTagsForSheet(moods: MoodChip[], genres: GenreCount[]): TagSheetSection[] {
  const byCountDesc = (a: TagSheetItem, b: TagSheetItem) => b.count - a.count || a.label.localeCompare(b.label, 'ru');

  const moodItems = moods
    .filter((m) => m.count > 0)
    .map(({ mood, count }): TagSheetItem => ({ key: mood, label: MOOD_LABELS[mood], kind: 'mood', count }))
    .sort(byCountDesc);

  const genreCounts = new Map(genres.map((g) => [g.genre, g.count]));

  const genreSections: TagSheetSection[] = GENRE_GROUPS.map((group) => ({
    label: group.label,
    items: group.genres
      .map((genre): TagSheetItem => ({ key: genre, label: GENRE_LABELS[genre], kind: 'genre', count: genreCounts.get(genre) ?? 0 }))
      .filter((item) => item.count > 0)
      .sort(byCountDesc),
  })).filter((section) => section.items.length > 0);

  const sections: TagSheetSection[] = [];
  if (moodItems.length > 0) sections.push({ label: 'Настроения', items: moodItems });
  sections.push(...genreSections);
  return sections;
}

/** Фильтр шита по вводу — регистронезависимо по лейблу, пустые секции отбрасываются. */
export function filterTagSections(sections: TagSheetSection[], query: string): TagSheetSection[] {
  const q = query.trim().toLowerCase();
  if (!q) return sections;
  return sections
    .map((section) => ({ ...section, items: section.items.filter((item) => item.label.toLowerCase().includes(q)) }))
    .filter((section) => section.items.length > 0);
}
