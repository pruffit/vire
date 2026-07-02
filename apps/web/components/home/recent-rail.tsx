import type { PlayableChartTrack } from '@vire/db';
import { Section } from '@/components/listener/section';
import { CoverRail } from './cover-rail';

export function RecentRail({ tracks }: { tracks: PlayableChartTrack[] }) {
  if (tracks.length === 0) return null;
  return (
    <Section title="Продолжить слушать">
      <CoverRail tracks={tracks} />
    </Section>
  );
}
