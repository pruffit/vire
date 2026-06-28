import Image from 'next/image';
import Link from 'next/link';
import type { DiscoveryRelease } from '@vire/db';
import { FeaturedPlayButton } from './featured-play-button';
import { ExplicitBadge } from '@/components/explicit-badge';
import { Icon } from '@/components/icon';

const typeLabel: Record<string, string> = {
  ALBUM: 'Альбом',
  SINGLE: 'Сингл',
  EP: 'EP',
  COMPILATION: 'Сборник',
};

function releaseYear(d: Date | null): string | null {
  if (!d) return null;
  const y = new Date(d).getFullYear();
  return Number.isFinite(y) ? String(y) : null;
}

export function FeaturedRelease({ release }: { release: DiscoveryRelease }) {
  const yr = releaseYear(release.releaseDate);
  const href = `/artists/${release.artistSlug}/releases/${release.id}`;
  const meta = [typeLabel[release.type] ?? release.type, yr].filter(Boolean).join(' · ');
  const hasImage = !!release.coverUrl;

  return (
    <section
      aria-label="Редакционный выбор"
      className="relative h-[360px] sm:h-[400px] rounded-2xl overflow-hidden"
    >
      {release.coverUrl ? (
        <>
          {/* Обложка квадратная — на широкой полосе её детали растягиваются некрасиво.
              Поэтому она тут только как ambient-источник цвета: сильный блюр + апскейл
              (scale прячет края блюра в overflow), детали растворяются в цветовом фоне. */}
          <Image
            src={release.coverUrl}
            alt=""
            aria-hidden
            fill
            className="object-cover scale-125 blur-2xl saturate-[1.35] brightness-[0.82]"
            priority
            // Next не проставляет fetchpriority=high при priority — нужно для LCP
            fetchPriority="high"
            // Фон размывается — детали не нужны, берём пониже для веса
            quality={45}
            sizes="(max-width: 768px) 100vw, calc(100vw - 18rem)"
          />
          {/* Скримы под текст */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/15" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/65 to-transparent" />
          {/* Стеклянный блик: верхняя кромка + мягкий радиальный хайлайт */}
          <div className="absolute inset-x-0 top-0 h-px bg-white/15" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_15%_0%,rgba(255,255,255,0.10),transparent_55%)]" />
        </>
      ) : (
        <div className="absolute inset-0 bg-muted flex items-center justify-center">
          <Icon name="music" size={48} className="opacity-20" />
        </div>
      )}

      <div className="absolute inset-0 z-10 flex flex-col justify-end p-6 sm:p-10 gap-3">
        <Link
          href={`/artists/${release.artistSlug}`}
          className={`text-xs font-mono uppercase tracking-[0.18em] transition-colors self-start ${
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
    </section>
  );
}
