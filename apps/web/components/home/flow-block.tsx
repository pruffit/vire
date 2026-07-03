import type { GenreCount } from '@vire/db';
import type { MoodChip } from '@/components/mood-wave-chips';
import { moodChipItems } from '@/components/mood-wave-chips';
import { WaveStartButton } from '@/components/wave-start-button';
import { WaveChipRow, type WaveChipItem } from '@/components/home/wave-chips';
import { GENRE_LABELS } from '@/lib/genres';

function genreChipItems(genres: GenreCount[]): WaveChipItem[] {
  return genres.map(({ genre, count }) => ({ key: genre, label: GENRE_LABELS[genre], count, kind: 'genre' }));
}

export function FlowBlock({ moods, genres }: { moods: MoodChip[]; genres: GenreCount[] }) {
  return (
    <section aria-label="Поток" className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-5 sm:p-6 space-y-4">
      <WaveStartButton />
      <WaveChipRow title="Настроение" items={moodChipItems(moods)} />
      <WaveChipRow title="Жанр" items={genreChipItems(genres)} />
    </section>
  );
}
