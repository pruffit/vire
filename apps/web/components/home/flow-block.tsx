import { getTranslations } from 'next-intl/server';
import type { GenreCount } from '@vire/db';
import { genreLabel, genreGroupLabel } from '@/lib/genres';
import { WaveStartButton } from '@/components/wave-start-button';
import { WaveChips } from '@/components/home/wave-chips';
import { type MoodChip, type TagLabelTranslators, waveChips, groupTagsForSheet } from '@/components/home/wave-chip-items';

export async function FlowBlock({ moods, genres }: { moods: MoodChip[]; genres: GenreCount[] }) {
  const [t, tMoods, tGenres, tSheet] = await Promise.all([
    getTranslations('home.flowBlock'),
    getTranslations('moods'),
    getTranslations('genres'),
    getTranslations('home.allTagsSheet'),
  ]);
  const labels: TagLabelTranslators = {
    moodLabel: (mood) => tMoods(mood),
    genreLabel: (genre) => genreLabel(genre, tGenres),
    groupLabel: (group) => genreGroupLabel(group, tGenres),
  };
  const chips = waveChips(moods, genres, labels);
  const sections = groupTagsForSheet(moods, genres, labels, tSheet('moodsHeading'));
  return (
    <section aria-label={t('aria')} className="rounded-2xl bg-foreground/[0.03] ring-1 ring-border p-5 sm:p-6 space-y-4">
      <WaveStartButton />
      {chips.length > 0 && <WaveChips items={chips} sections={sections} />}
    </section>
  );
}
