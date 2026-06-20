import Link from 'next/link';
import { auth } from '@/auth';
import {
  getLatestReleases,
  getUpcomingReleases,
  listActiveArtists,
  getFeed,
  getMoodCounts,
  getEditorialPlaylists,
  getPersonalPlaylists,
  getPopularPlaylists,
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
import { Reveal } from '@vire/ui/motion';
import { JsonLd } from '@/components/json-ld';
import { websiteJsonLd } from '@/lib/structured-data';
import type { Metadata } from 'next';

// Главная: явный canonical (в аудите был пустой). OG-картинку наследует из
// app/opengraph-image.tsx, title/description — из layout.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default async function HomePage() {
  const session = await auth();
  const userId = session?.user?.id;

  const [latest, upcoming, artists, feed, listeningNow, moodCounts, sharedPlaylists, personalRaw, publicPlaylists, likedPlaylistIds] = await Promise.all([
    getLatestReleases(13),
    getUpcomingReleases(8),
    listActiveArtists(),
    userId ? getFeed(userId) : Promise.resolve([]),
    getListeningNow(6),
    getMoodCounts().catch(() => []),
    getEditorialPlaylists(4),
    userId ? getPersonalPlaylists(userId, 4) : Promise.resolve([]),
    getPublicUserPlaylists(8),
    userId ? getLikedPlaylistIds(userId) : Promise.resolve([]),
  ]);

  // «Подборки» = две группы: 4 общих (одинаковы для всех) + 4 личных. Личную
  // половину при нехватке сигнала (гость/новый юзер) добиваем популярным, чтобы
  // сетка всегда была полной.
  let personalPlaylists = personalRaw;
  if (personalPlaylists.length < 4) {
    const exclude = [...sharedPlaylists, ...personalPlaylists].map((p) => p.id);
    const fill = await getPopularPlaylists(4 - personalPlaylists.length, exclude);
    personalPlaylists = [...personalPlaylists, ...fill];
  }
  const editorialPlaylists = [...sharedPlaylists, ...personalPlaylists];

  const featured = latest[0] ?? null;
  const rest = latest.slice(1, 13);

  const topArtists = artists.slice(0, 12);
  const empty = latest.length === 0 && upcoming.length === 0 && topArtists.length === 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 space-y-16">
      <JsonLd data={websiteJsonLd()} />
      <h1 className="sr-only">Vire — независимая музыкальная площадка для артистов и слушателей СНГ</h1>
      {/* Редакционный выбор — без FadeUp: FeaturedRelease содержит LCP-изображение,
          анимация opacity:0→1 задерживает его обнаружение браузером (+1-2с на LCP) */}
      {featured && <FeaturedRelease release={featured} />}

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

      {/* Редакционные подборки — без motion-обёрток: transform/will-change на
          обёртках делают блок отдельным композит-слоем, и он «дрожит» при скролле
          относительно остального документа. Здесь только обычные div. */}
      {editorialPlaylists.length > 0 && (
        <Section title="Подборки">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
            {editorialPlaylists.map((p) => (
              <EditorialPlaylistCard
                key={p.id}
                playlist={p}
                liked={likedPlaylistIds.includes(p.id)}
              />
            ))}
          </div>
        </Section>
      )}

      {/* Публичные плейлисты слушателей — тоже без motion (см. выше). */}
      {publicPlaylists.length > 0 && (
        <Section title="Плейлисты слушателей">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
            {publicPlaylists.map((p) => (
              <EditorialPlaylistCard
                key={p.id}
                playlist={p}
                liked={likedPlaylistIds.includes(p.id)}
              />
            ))}
          </div>
        </Section>
      )}

      {/* Активность подписок (для вошедших) */}
      {feed.length > 0 && (
        <Reveal>
          <Section title="Новое у тех, на кого ты подписан">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {feed.slice(0, 8).map((r) => (
                <ReleaseQuickLook key={r.id} release={r} />
              ))}
            </div>
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
