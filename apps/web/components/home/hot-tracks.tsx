import { getTranslations } from 'next-intl/server';
import type { PlayableChartTrack } from '@vire/db';
import { Section } from '@/components/listener/section';
import { PlayableTrackList } from '@/components/track-list';

export async function HotTracks({ tracks }: { tracks: PlayableChartTrack[] }) {
  if (tracks.length === 0) return null;
  const t = await getTranslations('home.sections');
  return (
    <Section title={t('hotTracks')} href="/releases" hrefLabel={t('wholeCatalog')}>
      <PlayableTrackList variant="ranked" columns={2} tracks={tracks} context={{ source: 'home' }} />
    </Section>
  );
}
