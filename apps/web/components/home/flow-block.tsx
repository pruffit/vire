import type { MoodChip } from '@/components/mood-wave-chips';
import { WaveStartButton } from '@/components/wave-start-button';
import { MoodWaveChips } from '@/components/mood-wave-chips';

export function FlowBlock({ moods }: { moods: MoodChip[] }) {
  return (
    <section aria-label="Поток" className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-5 sm:p-6 space-y-4">
      <WaveStartButton />
      {moods.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Или выбери настроение</p>
          <MoodWaveChips moods={moods} />
        </div>
      )}
    </section>
  );
}
