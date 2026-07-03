import type { GenreCount } from '@vire/db';
import { WaveStartButton } from '@/components/wave-start-button';
import { WaveChipRow } from '@/components/home/wave-chips';
import { type MoodChip, moodChipItems, genreChipItems } from '@/components/home/wave-chip-items';

export function FlowBlock({ moods, genres }: { moods: MoodChip[]; genres: GenreCount[] }) {
  return (
    <section aria-label="Поток" className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-5 sm:p-6 space-y-4">
      <WaveStartButton />
      <WaveChipRow title="Настроение" items={moodChipItems(moods)} />
      <WaveChipRow title="Жанр" items={genreChipItems(genres)} />
    </section>
  );
}
