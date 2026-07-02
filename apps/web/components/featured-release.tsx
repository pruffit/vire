import Image from 'next/image';
import Link from 'next/link';
import type { DiscoveryRelease } from '@vire/db';
import { FeaturedPlayButton } from './featured-play-button';
import { ExplicitBadge } from '@/components/explicit-badge';
import { Icon } from '@/components/icon';
import { releaseYear } from '@/lib/format';

const typeLabel: Record<string, string> = {
  ALBUM: 'Альбом', SINGLE: 'Сингл', EP: 'EP', COMPILATION: 'Сборник',
};

// Дефолтный нейтральный accent из темы — на нём одного цвета мало, подмешиваем блюр обложки.
const NEUTRAL_ACCENT = '#4a5568';

export function FeaturedRelease({ release }: { release: DiscoveryRelease }) {
  const yr = releaseYear(release.releaseDate);
  const href = `/artists/${release.artistSlug}/releases/${release.id}`;
  const meta = [typeLabel[release.type] ?? release.type, yr].filter(Boolean).join(' · ');
  const hasImage = !!release.coverUrl;
  const accent = release.accentColor ?? NEUTRAL_ACCENT;
  const neutral = accent.toLowerCase() === NEUTRAL_ACCENT;

  return (
    <section
      aria-label="Редакционный выбор"
      className="relative h-96 sm:h-[26rem] rounded-2xl overflow-hidden ring-1 ring-inset ring-white/10 isolate"
      style={{ backgroundColor: '#0c0b0a' }}
    >
      {/* Иммерсивный акцент: свечение из цвета релиза */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 120% at 12% 10%, ${accent}66, transparent 55%), linear-gradient(120deg, ${accent}40 0%, transparent 60%)`,
        }}
      />
      {/* Для нейтрального accent — слабый блюр обложки, чтобы не было «серо» */}
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
      {/* Затемнение под текст (контраст) */}
      <div aria-hidden className="absolute inset-0 bg-linear-to-t from-black/85 via-black/45 to-black/15" />
      <div aria-hidden className="absolute inset-0 bg-linear-to-r from-black/70 via-black/20 to-transparent" />

      <div className="absolute inset-0 z-10 grid grid-cols-1 items-end gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-10">
        <div className="flex min-w-0 flex-col gap-3">
          <Link
            href={`/artists/${release.artistSlug}`}
            className="self-start text-xs font-mono uppercase tracking-[0.18em] text-white/70 hover:text-white transition-colors"
          >
            {release.artistName}
          </Link>
          <h2 className="text-4xl sm:text-6xl font-bold tracking-tighter leading-[1.02] text-balance text-white">
            {release.title}
            {release.hasExplicit && <ExplicitBadge className="ml-2 align-middle" />}
          </h2>
          <p className="text-xs font-mono text-white/70">{meta}</p>
          <div className="flex items-center gap-4 pt-1">
            <FeaturedPlayButton
              releaseId={release.id}
              artistName={release.artistName}
              coverUrl={release.coverUrl}
              artistSlug={release.artistSlug}
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
            className="group hidden shrink-0 self-center sm:block"
          >
            <span className="block aspect-square w-44 lg:w-56 overflow-hidden rounded-xl ring-1 ring-white/15 shadow-2xl shadow-black/60 transition-transform duration-300 ease-out group-hover:-translate-y-1">
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
          <div aria-hidden className="hidden sm:grid place-items-center w-44 h-44 rounded-xl bg-white/5 ring-1 ring-white/10">
            <Icon name="music" size={40} className="opacity-30" />
          </div>
        )}
      </div>
    </section>
  );
}
