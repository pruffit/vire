import { getTranslations } from 'next-intl/server';
import { buildDiscovery } from '@/lib/discovery';
import { discoveryReasonLabel } from '@/lib/discovery-reason';
import { Section } from '@/components/listener/section';
import { ScrollRow } from '@/components/scroll-row';
import { ArtistCard } from '@/components/artist-card';

// холодный старт: на главной уже есть общая секция «Артисты» — дубль-заглушка не нужна
export const DISCOVERY_MIN_CANDIDATES = 4;

export async function DiscoverySection({ userId }: { userId: string }) {
  const artists = await buildDiscovery(userId).catch(() => []);
  if (artists.length < DISCOVERY_MIN_CANDIDATES) return null;
  const [t, tCommon] = await Promise.all([getTranslations('home.sections'), getTranslations('common')]);

  return (
    <Section title={t('discoveries')} count={artists.length}>
      <ScrollRow bleedClassName="-mx-1 -my-2" className="flex gap-5 px-1 py-2 snap-x">
        {artists.map((a) => (
          <div key={a.artistProfileId} className="flex-[1_0_9rem] max-w-[10rem] min-w-0 snap-start">
            <ArtistCard
              id={a.artistProfileId}
              slug={a.artistSlug}
              name={a.artistName}
              avatarUrl={a.artistAvatarUrl}
              verified={a.verified}
              stat={discoveryReasonLabel(a.reason, tCommon)}
            />
          </div>
        ))}
      </ScrollRow>
    </Section>
  );
}
