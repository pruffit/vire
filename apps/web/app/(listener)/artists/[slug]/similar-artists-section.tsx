import { buildSimilarArtists } from '@/lib/discovery';
import { discoveryReasonLabel } from '@/lib/discovery-reason';
import { SectionHeader } from '@/components/section-header';
import { ScrollRow } from '@/components/scroll-row';
import { ArtistCard } from '@/components/artist-card';

// анониму тоже нужен блок — сигнал считается по самому артисту, не по пользователю
export const SIMILAR_ARTISTS_MIN_CANDIDATES = 3;

export async function SimilarArtistsSection({ artistProfileId }: { artistProfileId: string }) {
  const artists = await buildSimilarArtists(artistProfileId).catch(() => []);
  if (artists.length < SIMILAR_ARTISTS_MIN_CANDIDATES) return null;

  return (
    <section className="animate-fade-up">
      <SectionHeader label="Похожие артисты" />
      <ScrollRow bleedClassName="-mx-1 -my-2" className="flex gap-5 px-1 py-2 snap-x">
        {artists.map((a) => (
          <div key={a.artistProfileId} className="flex-[1_0_9rem] max-w-[10rem] min-w-0 snap-start">
            <ArtistCard
              id={a.artistProfileId}
              slug={a.artistSlug}
              name={a.artistName}
              avatarUrl={a.artistAvatarUrl}
              verified={a.verified}
              stat={discoveryReasonLabel(a.reason)}
            />
          </div>
        ))}
      </ScrollRow>
    </section>
  );
}
