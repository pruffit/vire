import { describe, expect, it } from 'vitest';
import { getTranslator } from '@vire/i18n/translator';
import { waveChips, groupTagsForSheet, filterTagSections, type TagLabelTranslators } from './wave-chip-items';
import { genreLabel, genreGroupLabel } from '@/lib/genres';
import type { Mood } from '@/lib/moods';
import type { Genre } from '@/lib/genres';

const m = (mood: Mood, count: number) => ({ mood, count });
const g = (genre: Genre, count: number) => ({ genre, count });

const tMoods = await getTranslator('ru', 'moods');
const tGenres = await getTranslator('ru', 'genres');
const tHome = await getTranslator('ru', 'home');
const labels: TagLabelTranslators = {
  moodLabel: (mood) => tMoods(mood),
  genreLabel: (genre) => genreLabel(genre, tGenres),
  groupLabel: (group) => genreGroupLabel(group, tGenres),
};
const moodsHeading = tHome('moodsHeading');
const hiphopRnbLabel = tGenres('groups.hiphopRnb');
const technoLabel = tGenres('groups.techno');
const ambientLabel = tGenres('labels.AMBIENT');

describe('waveChips', () => {
  it('смешивает mood и genre по убыванию count, без ограничения на длину', () => {
    const chips = waveChips(
      [m('DARK', 10), m('HYPE', 3)],
      [g('HIPHOP', 7), g('ROCK', 5), g('ELECTRONIC', 1)],
      labels,
    );
    expect(chips.map((c) => c.key)).toEqual(['DARK', 'HIPHOP', 'ROCK', 'HYPE', 'ELECTRONIC']);
  });

  it('не режет каталог — возвращает все теги', () => {
    const moods = (['DARK', 'HYPE', 'SAD', 'UPLIFTING', 'NIGHT'] as Mood[]).map((x, i) => m(x, 100 - i));
    const genres = (['HIPHOP', 'ROCK', 'ELECTRONIC', 'POP', 'JAZZ'] as Genre[]).map((x, i) => g(x, 50 - i));
    expect(waveChips(moods, genres, labels)).toHaveLength(10);
  });

  it('kind сохраняется для сида волны', () => {
    const chips = waveChips([m('DARK', 1)], [g('ROCK', 2)], labels);
    expect(chips.find((c) => c.key === 'ROCK')?.kind).toBe('genre');
    expect(chips.find((c) => c.key === 'DARK')?.kind).toBe('mood');
  });

  it('совпадающие лейблы mood/genre («Эмбиент») не дублируются — выигрывает более популярный', () => {
    const chips = waveChips([m('AMBIENT', 3)], [g('AMBIENT', 9), g('ROCK', 1)], labels);
    const ambient = chips.filter((c) => c.label === ambientLabel);
    expect(ambient).toHaveLength(1);
    expect(ambient[0].kind).toBe('genre');
  });
});

describe('groupTagsForSheet', () => {
  it('кладёт moods в секцию «Настроения», genres — по GENRE_GROUPS', () => {
    const sections = groupTagsForSheet(
      [m('HYPE', 5)],
      [g('BOOMBAP', 2), g('TECHNO', 1)],
      labels,
      moodsHeading,
    );
    const sectionLabels = sections.map((s) => s.label);
    expect(sectionLabels).toContain(moodsHeading);
    expect(sectionLabels).toContain(hiphopRnbLabel);
    expect(sectionLabels).toContain(technoLabel);
  });

  it('отбрасывает теги с count = 0 и пустые секции', () => {
    const sections = groupTagsForSheet(
      [m('HYPE', 0), m('DARK', 5)],
      [g('BOOMBAP', 0)],
      labels,
      moodsHeading,
    );
    const moodSection = sections.find((s) => s.label === moodsHeading);
    expect(moodSection?.items.map((i) => i.key)).toEqual(['DARK']);
    expect(sections.some((s) => s.label === hiphopRnbLabel)).toBe(false);
  });

  it('внутри секции сортирует по count desc', () => {
    const sections = groupTagsForSheet(
      [],
      [g('BOOMBAP', 1), g('TRAP', 9), g('DRILL', 4)],
      labels,
      moodsHeading,
    );
    const hiphop = sections.find((s) => s.label === hiphopRnbLabel);
    expect(hiphop?.items.map((i) => i.key)).toEqual(['TRAP', 'DRILL', 'BOOMBAP']);
  });

  it('нет тегов с mood — секция «Настроения» отсутствует', () => {
    const sections = groupTagsForSheet([m('HYPE', 0)], [g('TECHNO', 1)], labels, moodsHeading);
    expect(sections.some((s) => s.label === moodsHeading)).toBe(false);
  });
});

describe('filterTagSections', () => {
  const sections = groupTagsForSheet(
    [m('HYPE', 5), m('DARK', 3)],
    [g('BOOMBAP', 2), g('TECHNO', 1)],
    labels,
    moodsHeading,
  );

  it('пустой запрос возвращает секции без изменений', () => {
    expect(filterTagSections(sections, '')).toEqual(sections);
  });

  it('фильтрует регистронезависимо по лейблу', () => {
    const filtered = filterTagSections(sections, 'boom');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].items.map((i) => i.key)).toEqual(['BOOMBAP']);
  });

  it('отбрасывает секции без совпадений', () => {
    const filtered = filterTagSections(sections, 'boom');
    expect(filtered.some((s) => s.label === moodsHeading)).toBe(false);
    expect(filtered.some((s) => s.label === technoLabel)).toBe(false);
  });

  it('нет совпадений — пустой массив', () => {
    expect(filterTagSections(sections, 'zzz-no-match')).toEqual([]);
  });
});
