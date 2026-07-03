import type { PlayableChartTrack } from '@vire/db';
import { Section } from '@/components/listener/section';
import { PlayableTrackList } from '@/components/track-list';

export function HotTracks({ tracks }: { tracks: PlayableChartTrack[] }) {
  if (tracks.length === 0) return null;
  return (
    <Section title="Горячие треки" href="/releases" hrefLabel="Весь каталог">
      <PlayableTrackList variant="ranked" columns={2} tracks={tracks} context={{ source: 'home' }} />
    </Section>
  );
}
