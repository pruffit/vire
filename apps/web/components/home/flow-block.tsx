import type { GenreCount } from '@vire/db';
import { WaveStartButton } from '@/components/wave-start-button';
import { WaveChips } from '@/components/home/wave-chips';
import { type MoodChip, topWaveChips } from '@/components/home/wave-chip-items';

export function FlowBlock({ moods, genres }: { moods: MoodChip[]; genres: GenreCount[] }) {
  const chips = topWaveChips(moods, genres);
  return (
    <section aria-label="Поток" className="rounded-2xl bg-foreground/[0.03] ring-1 ring-border p-5 sm:p-6 space-y-4">
      <WaveStartButton />
      {chips.length > 0 && <WaveChips items={chips} />}
    </section>
  );
}
