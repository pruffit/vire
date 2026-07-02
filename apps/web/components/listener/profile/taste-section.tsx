import Link from 'next/link';
import Image from 'next/image';
import type { ListenerTaste } from '@vire/db';
import { Section } from '@/components/listener/section';
import { EmptyState } from '@/components/ui-kit';
import { GENRE_LABELS, type Genre } from '@/lib/genres';
import { Icon } from '@/components/icon';
import { resolveAvatarUrl } from '@/lib/avatar';

interface Props {
  genres: ListenerTaste['topGenres'];
  artists: ListenerTaste['topArtists'];
}

export function TasteSection({ genres, artists }: Props) {
  return (
    <section className="animate-fade-up">
      <Section title="Музыкальный вкус">
        {genres.length === 0 && artists.length === 0 ? (
          <EmptyState
            title="Твой музыкальный портрет пока пуст"
            hint="Лайкай треки — здесь появятся любимые жанры и артисты."
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
                    {GENRE_LABELS[g.genre as Genre] ?? g.genre}
                  </span>
                ))}
              </div>
            )}
            {artists.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-x-5 gap-y-6">
                {artists.map((artist) => {
                  const avatar = resolveAvatarUrl(artist.avatarUrl, null);
                  return (
                    <Link key={artist.id} href={`/artists/${artist.slug}`} className="block group text-center">
                      <div className="relative mx-auto w-full aspect-square rounded-full overflow-hidden bg-muted ring-1 ring-white/5 transition-shadow duration-300 ease-soft group-hover:ring-white/20">
                        {avatar ? (
                          <Image
                            src={avatar}
                            alt={artist.name}
                            fill
                            sizes="(max-width: 640px) 30vw, 128px"
                            className="object-cover transition-transform duration-500 ease-soft group-hover:scale-[1.04]"
                          />
                        ) : (
                          <div className="w-full h-full grid place-items-center text-xl font-mono text-muted-foreground">
                            {artist.name[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>
                      <p className="mt-2 flex items-center justify-center gap-1 text-xs font-medium leading-snug group-hover:text-foreground transition-colors">
                        <span className="min-w-0 truncate">{artist.name}</span>
                        {artist.verified && <Icon name="check" size={11} className="text-muted-foreground shrink-0" />}
                      </p>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Section>
    </section>
  );
}
