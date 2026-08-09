import { getTranslations } from 'next-intl/server';
import type { ListenerTaste } from '@vire/db';
import { Section } from '@/components/listener/section';
import { EmptyState } from '@/components/ui-kit';
import { genreLabel, isGenre } from '@/lib/genres';
import { ArtistCard } from '@/components/artist-card';

interface Props {
  genres: ListenerTaste['topGenres'];
  artists: ListenerTaste['topArtists'];
}

export async function TasteSection({ genres, artists }: Props) {
  const [t, tGenres] = await Promise.all([getTranslations('profile.tasteSection'), getTranslations('genres')]);
  return (
    <section className="animate-fade-up">
      <Section title={t('title')}>
        {genres.length === 0 && artists.length === 0 ? (
          <EmptyState
            title={t('emptyTitle')}
            hint={t('emptyHint')}
          />
        ) : (
          <div className="space-y-6">
            {genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {genres.map((g) => (
                  <span
                    key={g.genre}
                    className="px-2.5 py-1 rounded-full text-xs font-mono border border-border text-muted-foreground"
                  >
                    {isGenre(g.genre) ? genreLabel(g.genre, tGenres) : g.genre}
                  </span>
                ))}
              </div>
            )}
            {artists.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-x-5 gap-y-6">
                {artists.map((artist) => (
                  <ArtistCard
                    key={artist.id}
                    id={artist.id}
                    slug={artist.slug}
                    name={artist.name}
                    avatarUrl={artist.avatarUrl}
                    verified={artist.verified}
                    sizes="(max-width: 640px) 30vw, 128px"
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </Section>
    </section>
  );
}
