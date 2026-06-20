import Image from 'next/image';
import Link from 'next/link';
import type { DiscoveryRelease } from '@vire/db';
import { FeaturedPlayButton } from './featured-play-button';
import { Tilt } from './tilt';
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

  return (
    <section aria-label="Редакционный выбор" className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
      {/* Обложка — лёгкий 3D-тилт за курсором */}
      <Tilt>
        <div className="relative aspect-square w-full rounded-2xl overflow-hidden shadow-2xl shadow-black/60 ring-1 ring-white/[0.07]">
          {release.coverUrl ? (
            <Image
              src={release.coverUrl}
              alt={release.title}
              fill
              sizes="(max-width: 768px) 100vw, 45vw"
              className="object-cover"
              priority
              // Next 16 при priority не проставляет fetchpriority=high сам —
              // без него браузер на узком 4G грузит hero-обложку (LCP) в общей
              // очереди, после JS/прочих картинок (LCP ~8с). Форсируем явно.
              fetchPriority="high"
            />
          ) : (
            <div className="w-full h-full bg-muted grid place-items-center">
              <NoteIcon />
            </div>
          )}
        </div>
      </Tilt>

      {/* Информация */}
      <div className="flex flex-col gap-5">
        {/* Артист — маленькая монолейбл-строка */}
        <Link
          href={`/artists/${release.artistSlug}`}
          className="text-xs font-mono uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors self-start"
        >
          {release.artistName}
        </Link>

        {/* Название релиза — герой */}
        <h2 className="text-4xl sm:text-5xl font-bold tracking-tighter leading-[1.05] text-balance">
          {release.title}
        </h2>

        {/* Тип · год */}
        <p className="text-xs font-mono text-muted-foreground/50">{meta}</p>

        {/* Кнопки */}
        <div className="flex items-center gap-4 pt-3">
          <FeaturedPlayButton
            releaseId={release.id}
            artistName={release.artistName}
            coverUrl={release.coverUrl}
            artistSlug={release.artistSlug}
          />
          <Link
            href={href}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            К релизу →
          </Link>
        </div>
      </div>
    </section>
  );
}

function NoteIcon() {
  return <Icon name="music" size={48} className="opacity-20" />;
}
