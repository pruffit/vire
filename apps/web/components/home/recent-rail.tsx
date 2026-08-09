import { getTranslations } from 'next-intl/server';
import type { PlayableChartTrack } from '@vire/db';
import { Section } from '@/components/listener/section';
import { CoverRail } from './cover-rail';

export async function RecentRail({ tracks }: { tracks: PlayableChartTrack[] }) {
  if (tracks.length === 0) return null;
  const t = await getTranslations('home.sections');
  return (
    <Section title={t('continueListening')}>
      <CoverRail tracks={tracks} />
    </Section>
  );
}
