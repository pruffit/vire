import Link from 'next/link';
import Image from 'next/image';
import { auth } from '@/auth';
import {
  getLatestReleases,
  getUpcomingReleases,
  listActiveArtists,
  getFeed,
  type DiscoveryRelease,
  type ArtistListItem,
} from '@vire/db';
import { GlobalSearch } from '@/components/global-search';
import { FadeUp, Stagger, StaggerItem, Reveal } from '@vire/ui/motion';
import { releaseYear } from '@/lib/format';

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
                <ReleaseCard release={r} />
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
                <ReleaseCard key={r.id} release={r} upcoming />
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
                <ReleaseCard key={r.id} release={r} />
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
                <ArtistChip key={a.id} artist={a} />
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

function ReleaseCard({ release, upcoming }: { release: DiscoveryRelease; upcoming?: boolean }) {
  const year = releaseYear(release.releaseDate);
  return (
    <Link
      href={`/artists/${release.artistSlug}/releases/${release.id}`}
      className="block group"
    >
      <div className="relative aspect-square rounded-md overflow-hidden bg-muted ring-1 ring-white/5 transition-all duration-300 ease-soft group-hover:ring-white/20 group-hover:shadow-xl group-hover:shadow-black/30">
        {release.coverUrl ? (
          <Image
            src={release.coverUrl}
            alt={release.title}
            fill
            sizes="(max-width: 640px) 50vw, 250px"
            className="object-cover transition-transform duration-500 ease-soft group-hover:scale-[1.04]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-20">
            <NoteIcon />
          </div>
        )}
        {upcoming && release.releaseDate && (
          <span className="absolute top-2 left-2 rounded-full bg-black/60 backdrop-blur-sm px-2 py-0.5 text-[10px] font-mono text-white/90">
            {untilLabel(release.releaseDate)}
          </span>
        )}
      </div>
      <div className="mt-2.5 space-y-0.5">
        <p className="text-sm font-medium leading-snug truncate group-hover:text-foreground transition-colors">
          {release.title}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {release.artistName}
          <span className="opacity-50 font-mono">
            {' · '}
            {upcoming ? release.type : year ? `${year}` : release.type}
          </span>
        </p>
      </div>
    </Link>
  );
}

function ArtistChip({ artist }: { artist: ArtistListItem }) {
  return (
    <Link href={`/artists/${artist.slug}`} className="block group text-center">
      <div className="relative mx-auto w-full aspect-square rounded-full overflow-hidden bg-muted ring-1 ring-white/5 transition-shadow duration-300 ease-soft group-hover:ring-white/20">
        {artist.avatarUrl ? (
          <Image
            src={artist.avatarUrl}
            alt={artist.name}
            fill
            sizes="(max-width: 640px) 33vw, 160px"
            className="object-cover transition-transform duration-500 ease-soft group-hover:scale-[1.04]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl font-mono text-muted-foreground">
            {artist.name[0]?.toUpperCase()}
          </div>
        )}
      </div>
      <p className="mt-2 text-xs font-medium leading-snug truncate group-hover:text-foreground transition-colors">
        {artist.name}
      </p>
    </Link>
  );
}

/** «сегодня» / «завтра» / «через N дн.» / дата — для грядущих релизов. */
function untilLabel(date: Date): string {
  const MS = 86_400_000;
  const today = new Date();
  const d0 = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const d1 = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const days = Math.round((d1 - d0) / MS);
  if (days <= 0) return 'сегодня';
  if (days === 1) return 'завтра';
  if (days < 7) return `через ${days} дн.`;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function NoteIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
    </svg>
  );
}
