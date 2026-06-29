import Image from 'next/image';
import Link from 'next/link';
import type { DiscoveryRelease } from '@vire/db';
import { FeaturedPlayButton } from './featured-play-button';
import { ExplicitBadge } from '@/components/explicit-badge';
import { Icon } from '@/components/icon';
import { releaseYear } from '@/lib/format';

const typeLabel: Record<string, string> = {
  ALBUM: 'Альбом',
  SINGLE: 'Сингл',
  EP: 'EP',
  COMPILATION: 'Сборник',
};

export function FeaturedRelease({ release }: { release: DiscoveryRelease }) {
  const yr = releaseYear(release.releaseDate);
  const href = `/artists/${release.artistSlug}/releases/${release.id}`;
  const meta = [typeLabel[release.type] ?? release.type, yr].filter(Boolean).join(' · ');
  const hasImage = !!release.coverUrl;

  return (
    <section
      aria-label="Редакционный выбор"
      className="relative h-90 sm:h-100 rounded-2xl overflow-hidden ring-1 ring-inset ring-white/10"
    >
      {release.coverUrl ? (
        <>
          {/* Фон: обложка размыта до чистого цветового свечения, не «мыльного» арта */}
          <Image
            src={release.coverUrl}
            alt=""
            aria-hidden
            fill
            className="scale-[1.6] object-cover blur-[72px] saturate-[1.4] brightness-90"
            priority
            // Next не проставляет fetchpriority=high при priority — нужно для LCP
            fetchPriority="high"
            quality={35}
            sizes="(max-width: 768px) 100vw, calc(100vw - 18rem)"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-black/20" />
          <div className="absolute inset-0 bg-linear-to-r from-black/70 via-black/25 to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_12%_0%,rgba(255,255,255,0.10),transparent_55%)]" />
        </>
      ) : (
        <div className="absolute inset-0 bg-muted flex items-center justify-center">
          <Icon name="music" size={48} className="opacity-20" />
        </div>
      )}

      <div className="absolute inset-0 z-10 grid grid-cols-1 items-end gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-10">
        <div className="flex min-w-0 flex-col gap-3">
          <Link
            href={`/artists/${release.artistSlug}`}
            className={`self-start text-xs font-mono uppercase tracking-[0.18em] transition-colors ${
              hasImage ? 'text-white/70 hover:text-white' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {release.artistName}
          </Link>

          <h2
            className={`text-4xl sm:text-5xl font-bold tracking-tighter leading-[1.05] text-balance ${
              hasImage ? 'text-white' : 'text-foreground'
            }`}
          >
            {release.title}
            {release.hasExplicit && <ExplicitBadge className="ml-2 align-middle" />}
          </h2>

          <p className={`text-xs font-mono ${hasImage ? 'text-white/70' : 'text-muted-foreground'}`}>
            {meta}
          </p>

          <div className="flex items-center gap-4 pt-1">
            <FeaturedPlayButton
              releaseId={release.id}
              artistName={release.artistName}
              coverUrl={release.coverUrl}
              artistSlug={release.artistSlug}
            />
            <Link
              href={href}
              className={`inline-flex items-center gap-1 text-sm transition-colors ${
                hasImage ? 'text-white/80 hover:text-white' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              К релизу <Icon name="arrow-right" size={14} />
            </Link>
          </div>
        </div>

        {/* Резкая обложка — герой баннера, осязаемый объект */}
        {hasImage && (
          <Link
            href={href}
            aria-label={`${release.title} — к релизу`}
            className="group hidden shrink-0 self-center sm:block"
          >
            <span className="block aspect-square w-40 overflow-hidden rounded-xl ring-1 ring-white/15 shadow-2xl shadow-black/60 transition-transform duration-300 ease-out group-hover:-translate-y-1 lg:w-52">
              <Image
                src={release.coverUrl!}
                alt={`Обложка «${release.title}»`}
                width={224}
                height={224}
                className="h-full w-full object-cover"
                sizes="(max-width: 1024px) 160px, 208px"
              />
            </span>
          </Link>
        )}
      </div>
    </section>
  );
}
