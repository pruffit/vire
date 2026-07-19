import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { db, DrizzleArtistRepository, getSmartLinkBySlug, getSmartLinkRelease } from '@vire/db';
import { ArtistService } from '@vire/core';
import { artistFontStyle } from '@/lib/fonts';
import { GrainOverlay } from '@/components/grain-overlay';
import { PlatformIcon } from '@/components/platform-icon';
import { BrandIcon, PLATFORM_BRAND, isBrandWordmark } from '@/components/brand-icon';
import { Logo } from '@/components/logo';
import { detectPlatform, linkLabel } from '@/lib/platforms';
import { FadeUp, Stagger, StaggerItem } from '@vire/ui/motion';
import { JsonLd } from '@/components/json-ld';
import { Icon } from '@/components/icon';
import { abs } from '@/lib/structured-data';

type Props = { params: Promise<{ artistSlug: string; linkSlug: string }> };

async function getData(artistSlug: string, linkSlug: string) {
  const artistResult = await new ArtistService(new DrizzleArtistRepository(db), { now: () => Date.now() }).getBySlug(artistSlug);
  if (!artistResult.ok) return null;
  const artist = artistResult.value;
  const smartLink = await getSmartLinkBySlug(artist.id, linkSlug);
  if (!smartLink || !smartLink.isPublished) return null;

  // CTA только когда релиз опубликован или запланирован на будущее — черновик/архив не светим
  const release = smartLink.releaseId ? await getSmartLinkRelease(smartLink.releaseId) : null;
  let vire: { kind: 'listen' | 'presave'; href: string } | null = null;
  if (release) {
    const airedAt = release.releaseDate ? new Date(release.releaseDate).getTime() : null;
    const href = `/artists/${artist.slug}/releases/${release.id}`;
    if (release.status === 'PUBLISHED' || (release.status === 'SCHEDULED' && airedAt != null && airedAt <= Date.now())) {
      vire = { kind: 'listen', href };
    } else if (release.status === 'SCHEDULED' && airedAt != null && airedAt > Date.now()) {
      vire = { kind: 'presave', href };
    }
  }

  // Релиз дополняет пустые поля лендинга (обложка/название/дата) — не клобберит заданные.
  const display = {
    title: smartLink.title || release?.title || '',
    coverUrl: smartLink.coverUrl ?? release?.coverUrl ?? null,
    releaseDate: smartLink.releaseDate ?? release?.releaseDate ?? null,
  };

  return { artist, smartLink, vire, display };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { artistSlug, linkSlug } = await params;
  const data = await getData(artistSlug, linkSlug);
  if (!data) return { title: 'Не найдено' };
  const { artist, smartLink } = data;
  const title = `${smartLink.title} — ${artist.name}`;
  const description = smartLink.subtitle ?? `Слушай «${smartLink.title}» от ${artist.name} на всех площадках`;
  const url = `/smartlink/${artistSlug}/${linkSlug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      url,
      title,
      description,
      type: 'music.album',
      images: smartLink.coverUrl ? [{ url: smartLink.coverUrl }] : undefined,
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function SmartLinkPage({ params }: Props) {
  const { artistSlug, linkSlug } = await params;
  const data = await getData(artistSlug, linkSlug);
  if (!data) notFound();

  const { artist, smartLink, vire, display } = data;
  const { bg, text, accent, grain } = artist.themeTokens;
  const year = display.releaseDate ? new Date(display.releaseDate).getFullYear() : null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MusicAlbum',
    name: smartLink.title,
    url: abs(`/smartlink/${artist.slug}/${smartLink.slug}`),
    ...(smartLink.coverUrl ? { image: abs(smartLink.coverUrl) } : {}),
    ...(smartLink.releaseDate
      ? { datePublished: new Date(smartLink.releaseDate).toISOString().slice(0, 10) }
      : {}),
    byArtist: {
      '@type': 'MusicGroup',
      name: artist.name,
      url: abs(`/artists/${artist.slug}`),
    },
    ...(smartLink.links.length
      ? { sameAs: smartLink.links.map((l) => l.url) }
      : {}),
  };

  return (
    <>
    <JsonLd data={jsonLd} />
    <div
      style={
        {
          '--artist-bg': bg,
          '--artist-text': text,
          '--artist-accent': accent,
          background: 'var(--artist-bg)',
          ...artistFontStyle(artist.themeTokens),
        } as React.CSSProperties
      }
      className="relative min-h-full text-[var(--artist-text)] font-sans"
    >
      {grain && <GrainOverlay />}

      {/* Подсветка из акцента сверху */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[55vh] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 100% at 50% 0%, color-mix(in oklch, var(--artist-accent) 22%, transparent), transparent)',
        }}
      />

      <main className="relative mx-auto flex min-h-full max-w-md flex-col items-center px-6 py-12 sm:py-16">
        <FadeUp className="w-full flex flex-col items-center">
          {/* Обложка */}
          <div className="relative aspect-square w-56 sm:w-64 overflow-hidden rounded-2xl shadow-2xl shadow-black/50 ring-1 ring-white/10">
            {display.coverUrl ? (
              <Image
                src={display.coverUrl}
                alt={display.title}
                fill
                sizes="(max-width: 640px) 224px, 256px"
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[color-mix(in_oklch,var(--artist-accent)_25%,var(--artist-bg))]">
                <PlatformIcon platform="website" size={40} className="opacity-30" />
              </div>
            )}
          </div>

          {/* Заголовок */}
          <h1 className="mt-6 text-center text-2xl font-bold tracking-tight text-balance">
            {display.title}
          </h1>
          <p className="mt-1 text-center text-sm" style={{ color: 'color-mix(in oklch, var(--artist-text) 65%, transparent)' }}>
            <Link href={`/artists/${artist.slug}`} className="transition-opacity hover:opacity-70 underline-offset-2 hover:underline">
              {artist.name}
            </Link>
            {year != null && <span> · {year}</span>}
          </p>
          {smartLink.subtitle && (
            <p className="mt-2 text-center text-sm" style={{ color: 'color-mix(in oklch, var(--artist-text) 55%, transparent)' }}>
              {smartLink.subtitle}
            </p>
          )}
        </FadeUp>

        {/* Первой — кнопка Vire (если лендинг привязан к релизу): слушать/пресейв */}
        {vire && (
          <FadeUp className="mt-8 w-full">
            <Link
              href={vire.href}
              aria-label={vire.kind === 'listen' ? 'Слушать на Vire' : 'Пресейв на Vire'}
              className="group flex items-center gap-3.5 rounded-xl px-4 py-3.5 font-medium transition-all hover:scale-[1.015]"
              style={{
                background: 'var(--artist-accent)',
                color: 'color-mix(in oklch, var(--artist-bg) 88%, black)',
              }}
            >
              <span className="inline-flex shrink-0 items-center rounded-lg bg-white/90 px-2.5 py-2">
                <Logo className="h-3 w-auto text-black" />
              </span>
              <span className="flex-1 text-sm">
                {vire.kind === 'listen' ? 'Слушать на Vire' : 'Пресейв на Vire'}
              </span>
              <Icon name="arrow-right" size={16} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </FadeUp>
        )}

        {/* Кнопки площадок */}
        {smartLink.links.length > 0 && (
          <Stagger className={`${vire ? 'mt-2.5' : 'mt-8'} w-full space-y-2.5`}>
            {smartLink.links.map((link, i) => {
              const { key } = detectPlatform(link.url);
              const name = linkLabel(link.url, link.label);
              const brand = PLATFORM_BRAND[key];
              const wordmark = brand ? isBrandWordmark(brand) : false;
              return (
                <StaggerItem key={i}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={name}
                    className="group flex items-center gap-3.5 rounded-xl border px-4 py-3.5 transition-all hover:scale-[1.015]"
                    style={{
                      borderColor: 'color-mix(in oklch, var(--artist-text) 14%, transparent)',
                      background: 'color-mix(in oklch, var(--artist-text) 5%, transparent)',
                    }}
                  >
                    {brand ? (
                      // Белая плашка — лого читается на любой теме артиста (в т.ч. тёмной).
                      <span className="inline-flex shrink-0 items-center rounded-lg bg-white px-2 py-1.5">
                        <BrandIcon name={brand} size={wordmark ? 18 : 22} style={{ maxWidth: 88 }} />
                      </span>
                    ) : (
                      <PlatformIcon platform={key} size={22} className="shrink-0 opacity-90" />
                    )}
                    <span className="flex-1 text-sm font-medium">{name}</span>
                    <Icon
                      name="arrow-right"
                      size={16}
                      className="shrink-0 transition-transform group-hover:translate-x-0.5"
                      style={{ color: 'var(--artist-accent)' }}
                    />
                  </a>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}

        {/* Назад к артисту */}
        <Link
          href={`/artists/${artist.slug}`}
          className="mt-10 inline-flex items-center gap-1 text-xs transition-opacity hover:opacity-100"
          style={{ color: 'color-mix(in oklch, var(--artist-text) 45%, transparent)' }}
        >
          <Icon name="arrow-left" size={13} /> Все релизы {artist.name}
        </Link>
      </main>
    </div>
    </>
  );
}
