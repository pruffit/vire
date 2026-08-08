import Image from 'next/image';
import Link from 'next/link';
import type { DiscoveryRelease, ReleaseCardStats } from '@vire/db';
import { FeaturedPlayButton } from './featured-play-button';
import { ExplicitBadge } from '@/components/explicit-badge';
import { Icon } from '@/components/icon';
import { releaseYear, pluralTracks, formatDuration } from '@/lib/format';

const typeLabel: Record<string, string> = {
  ALBUM: 'Альбом', SINGLE: 'Сингл', EP: 'EP', COMPILATION: 'Сборник',
};

// Дефолтный нейтральный accent из темы: на нём одного цвета мало, подмешиваем блюр обложки.
const NEUTRAL_ACCENT = '#4a5568';

export function FeaturedRelease({ release, stats }: { release: DiscoveryRelease; stats?: ReleaseCardStats | null }) {
  const yr = releaseYear(release.releaseDate);
  const href = `/artists/${release.artistSlug}/releases/${release.id}`;
  const meta = [
    typeLabel[release.type] ?? release.type,
    yr,
    stats && stats.trackCount > 0 ? `${stats.trackCount} ${pluralTracks(stats.trackCount)}` : null,
    stats && stats.totalDurationSec > 0 ? formatDuration(stats.totalDurationSec) : null,
  ].filter(Boolean).join(' · ');
  const hasImage = !!release.coverUrl;
  const accent = release.accentColor ?? NEUTRAL_ACCENT;
  const neutral = accent.toLowerCase() === NEUTRAL_ACCENT;

  return (
    <section
      aria-label="Редакционный выбор"
      className="relative h-96 sm:h-[26rem] rounded-2xl overflow-hidden ring-1 ring-inset ring-white/10 isolate"
      style={{ backgroundColor: '#0c0b0a' }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 120% at 12% 10%, ${accent}66, transparent 55%), linear-gradient(120deg, ${accent}40 0%, transparent 60%)`,
        }}
      />
      {hasImage && neutral && (
        <Image
          src={release.coverUrl!}
          alt=""
          aria-hidden
          fill
          className="scale-[1.6] object-cover blur-[80px] saturate-[1.5] opacity-60"
          quality={30}
          sizes="(max-width: 768px) 100vw, calc(100vw - 18rem)"
        />
      )}
      <div aria-hidden className="absolute inset-0 bg-linear-to-t from-black/85 via-black/45 to-black/15" />
      <div aria-hidden className="absolute inset-0 bg-linear-to-r from-black/70 via-black/20 to-transparent" />

      <div className="absolute inset-0 z-10 grid grid-cols-1 items-end gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-10">
        <div className="order-2 flex min-w-0 flex-col gap-3 sm:order-1">
          <Link
            href={`/artists/${release.artistSlug}`}
            className="self-start label-wide text-white/70 hover:text-white transition-colors"
          >
            {release.artistName}
          </Link>
          <h2 className="text-4xl sm:text-6xl font-bold tracking-tighter leading-[1.02] text-balance text-white">
            {release.title}
            {release.hasExplicit && <ExplicitBadge className="ml-2 align-middle" />}
          </h2>
          <p className="text-xs font-mono tabular-nums text-white/70">{meta}</p>
          <div className="flex items-center gap-4 pt-1">
            <FeaturedPlayButton
              releaseId={release.id}
              artistName={release.artistName}
              coverUrl={release.coverUrl}
              artistSlug={release.artistSlug}
              accentColor={release.accentColor}
            />
            <Link href={href} className="inline-flex items-center gap-1 text-sm text-white/80 hover:text-white transition-colors">
              К релизу <Icon name="arrow-right" size={14} />
            </Link>
          </div>
        </div>

        {hasImage && (
          <Link
            href={href}
            aria-label={`${release.title} — к релизу`}
            className="group order-1 mx-auto shrink-0 self-start sm:order-2 sm:mx-0 sm:self-center"
          >
            <span className="block aspect-square w-36 overflow-hidden rounded-xl ring-1 ring-white/15 shadow-2xl shadow-black/60 transition-transform duration-300 ease-out group-hover:-translate-y-1 sm:w-44 lg:w-56">
              <Image
                src={release.coverUrl!}
                alt={`Обложка «${release.title}»`}
                width={224}
                height={224}
                priority
                fetchPriority="high"
                className="h-full w-full object-cover"
                sizes="(max-width: 1024px) 176px, 224px"
              />
            </span>
          </Link>
        )}

        {!hasImage && (
          <div
            aria-hidden
            className="order-1 mx-auto grid h-36 w-36 place-items-center rounded-xl bg-white/5 ring-1 ring-white/10 sm:order-2 sm:mx-0 sm:h-44 sm:w-44"
          >
            <Icon name="music" size={40} className="opacity-30" />
          </div>
        )}
      </div>
    </section>
  );
}
