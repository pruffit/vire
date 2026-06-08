import Link from 'next/link';
import { auth } from '@/auth';
import {
  getLatestReleases,
  getUpcomingReleases,
  listActiveArtists,
  getFeed,
} from '@vire/db';
import { GlobalSearch } from '@/components/global-search';
import { ReleaseQuickLook } from '@/components/release-quick-look';
import { ArtistHoverChip } from '@/components/artist-hover-chip';
import { FadeUp, Stagger, StaggerItem, Reveal } from '@vire/ui/motion';

export default async function HomePage() {
  const session = await auth();
  const userId = session?.user?.id;

  const [latest, upcoming, artists, feed] = await Promise.all([
    getLatestReleases(12),
    getUpcomingReleases(8),
    listActiveArtists(),
    userId ? getFeed(userId) : Promise.resolve([]),
  ]);

  const topArtists = artists.slice(0, 12);
  const empty = latest.length === 0 && upcoming.length === 0 && topArtists.length === 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 space-y-16">
      {/* Hero */}
      <FadeUp>
        <div className="flex flex-col items-center text-center gap-5 pt-4">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">Vire</h1>
          <p className="text-sm text-muted-foreground max-w-md">
            Независимая музыкальная площадка для артистов и слушателей СНГ
          </p>
          <div className="w-full flex justify-center pt-2">
            <GlobalSearch variant="hero" />
          </div>
        </div>
      </FadeUp>

      {/* Активность подписок (для вошедших) */}
      {feed.length > 0 && (
        <Section title="Новое у тех, на кого ты подписан">
          <Stagger className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {feed.slice(0, 8).map((r) => (
              <StaggerItem key={r.id}>
                <ReleaseQuickLook release={r} />
              </StaggerItem>
            ))}
          </Stagger>
        </Section>
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
      {latest.length > 0 && (
        <Reveal>
          <Section title="Свежие релизы">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {latest.map((r) => (
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
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-5">
              {topArtists.map((a) => (
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

