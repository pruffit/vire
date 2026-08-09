import { getTranslations } from 'next-intl/server';
import type { GenreCount } from '@vire/db';
import { WaveStartButton } from '@/components/wave-start-button';
import { WaveChips } from '@/components/home/wave-chips';
import { type MoodChip, waveChips, groupTagsForSheet } from '@/components/home/wave-chip-items';

export async function FlowBlock({ moods, genres }: { moods: MoodChip[]; genres: GenreCount[] }) {
  const t = await getTranslations('home.flowBlock');
  const chips = waveChips(moods, genres);
  const sections = groupTagsForSheet(moods, genres);
  return (
    <section aria-label={t('aria')} className="rounded-2xl bg-foreground/[0.03] ring-1 ring-border p-5 sm:p-6 space-y-4">
      <WaveStartButton />
      {chips.length > 0 && <WaveChips items={chips} sections={sections} />}
    </section>
  );
}
