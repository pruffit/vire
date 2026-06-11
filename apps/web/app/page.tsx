import Link from 'next/link';
import { auth } from '@/auth';
import {
  getLatestReleases,
  getUpcomingReleases,
  listActiveArtists,
  getFeed,
  getMoodCounts,
  getEditorialPlaylists,
  getPublicUserPlaylists,
  getLikedPlaylistIds,
} from '@vire/db';
import { ReleaseQuickLook } from '@/components/release-quick-look';
import { ArtistHoverChip } from '@/components/artist-hover-chip';
import { FeaturedRelease } from '@/components/featured-release';
import { WaveStartButton } from '@/components/wave-start-button';
import { ListeningNow } from '@/components/listening-now';
import { MoodWaveChips } from '@/components/mood-wave-chips';
import { EditorialPlaylistCard } from '@/components/editorial-playlist-card';
import { getListeningNow } from '@/lib/listening-now';
import { FadeUp, Stagger, StaggerItem, Reveal } from '@vire/ui/motion';

export default async function HomePage() {
  const session = await auth();
  const userId = session?.user?.id;

  const [latest, upcoming, artists, feed, listeningNow, moodCounts, editorialPlaylists, publicPlaylists, likedPlaylistIds] = await Promise.all([
    getLatestReleases(13),
    getUpcomingReleases(8),
    listActiveArtists(),
    userId ? getFeed(userId) : Promise.resolve([]),
    getListeningNow(6),
    getMoodCounts().catch(() => []),
    getEditorialPlaylists(8),
    getPublicUserPlaylists(8),
    userId ? getLikedPlaylistIds(userId) : Promise.resolve([]),
  ]);

  const featured = latest[0] ?? null;
  const rest = latest.slice(1, 13);

  const topArtists = artists.slice(0, 12);
  const empty = latest.length === 0 && upcoming.length === 0 && topArtists.length === 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 space-y-16">
      {/* Редакционный выбор */}
      {featured && (
        <FadeUp>
          <FeaturedRelease release={featured} />
        </FadeUp>
      )}

      {/* Wave — запуск потока */}
      <WaveStartButton />

      {/* Live: кто что слушает прямо сейчас (исчезает, когда никого) */}
      <ListeningNow initial={listeningNow} />

      {/* Поток по настроению */}
      {moodCounts.length > 0 && (
        <Reveal>
          <Section title="По настроению">
            <MoodWaveChips moods={moodCounts} />
          </Section>
        </Reveal>
      )}

      {/* Редакционные подборки */}
      {editorialPlaylists.length > 0 && (
        <Reveal>
          <Section title="Подборки">
            <Stagger className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
              {editorialPlaylists.map((p) => (
                <StaggerItem key={p.id}>
                  <EditorialPlaylistCard
                    playlist={p}
                    liked={likedPlaylistIds.includes(p.id)}
                  />
                </StaggerItem>
              ))}
            </Stagger>
          </Section>
        </Reveal>
      )}

      {/* Публичные плейлисты слушателей */}
      {publicPlaylists.length > 0 && (
        <Reveal>
          <Section title="Плейлисты слушателей">
            <Stagger className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
              {publicPlaylists.map((p) => (
                <StaggerItem key={p.id}>
                  <EditorialPlaylistCard
                    playlist={p}
                    liked={likedPlaylistIds.includes(p.id)}
                  />
                </StaggerItem>
              ))}
            </Stagger>
          </Section>
        </Reveal>
      )}

      {/* Активность подписок (для вошедших) */}
      {feed.length > 0 && (
        <Reveal>
          <Section title="Новое у тех, на кого ты подписан">
            <Stagger className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {feed.slice(0, 8).map((r) => (
                <StaggerItem key={r.id}>
                  <ReleaseQuickLook release={r} />
                </StaggerItem>
              ))}
            </Stagger>
          </Section>
        </Reveal>
      )}

      {/* Скоро выйдет */}
      {upcoming.length > 0 && (
        <Reveal>
          <Section title="Скоро выйдет">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {upcoming.map((r) => (
                <ReleaseQuickLook key={r.id} release={r} upcoming />
              ))}
            </div>
          </Section>
        </Reveal>
      )}

      {/* Свежие релизы */}
      {rest.length > 0 && (
        <Reveal>
          <Section title="Свежие релизы">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {rest.map((r) => (
                <ReleaseQuickLook key={r.id} release={r} />
              ))}
            </div>
          </Section>
        </Reveal>
      )}

      {/* Артисты */}
      {topArtists.length > 0 && (
        <Reveal>
          <Section title="Артисты" href="/artists" hrefLabel="Все артисты →">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-5">
              {topArtists.slice(0, 10).map((a) => (
                <ArtistHoverChip key={a.id} artist={a} />
              ))}
            </div>
          </Section>
        </Reveal>
      )}

      {empty && (
        <p className="text-center text-sm text-muted-foreground py-12">
          Пока пусто. Скоро здесь появится музыка.
        </p>
      )}
    </main>
  );
}

function Section({
  title,
  href,
  hrefLabel,
  children,
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {href && (
          <Link
            href={href}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {hrefLabel ?? 'Все →'}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
