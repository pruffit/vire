import { SITE_NAME } from '@/lib/site';

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CACHE_HEADERS = { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' };

const BG = 'radial-gradient(ellipse 90% 80% at 50% 0%, #2a2030, #141414)';

export type OgKind = 'РЕЛИЗ' | 'ТРЕК' | 'АРТИСТ' | 'ПЛЕЙЛИСТ' | 'СМАРТЛИНК';

/** Одна обложка, мозаика ≤4 (playlist) или null (плейсхолдер) — одна карточка на все сегменты. */
export type OgCover = string | string[] | null;

// Клэмп символами, а не CSS: satori переносит длинную строку и выдавливает вордмарк за кадр.
export function clampOgText(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

function CoverArt({ cover, size = 400 }: { cover: OgCover; size?: number }) {
  const list = cover === null ? [] : Array.isArray(cover) ? cover : [cover];

  if (list.length === 0) {
    return (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 24,
          background: '#221c26',
        }}
      >
        <span style={{ fontSize: size * 0.4, fontWeight: 800, color: '#4a3f52' }}>V</span>
      </div>
    );
  }

  if (list.length >= 4) {
    const half = size / 2;
    return (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          flexWrap: 'wrap',
          borderRadius: 24,
          overflow: 'hidden',
          background: '#221c26',
        }}
      >
        {list.slice(0, 4).map((src) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src} alt="" width={half} height={half} style={{ objectFit: 'cover' }} />
        ))}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={list[0]} alt="" width={size} height={size} style={{ objectFit: 'cover', borderRadius: 24 }} />
  );
}

export function ogCard({
  kind,
  title,
  subtitle,
  cover,
}: {
  kind: OgKind;
  title: string;
  subtitle: string;
  cover: OgCover;
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 64,
        padding: 80,
        background: BG,
        color: '#fafafa',
        fontFamily: 'sans-serif',
      }}
    >
      <CoverArt cover={cover} />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 26, letterSpacing: '0.18em', color: '#a79bb0' }}>{kind}</div>
        <div
          style={{
            marginTop: 20,
            fontSize: 76,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            display: 'block',
            maxWidth: 560,
            overflow: 'hidden',
          }}
        >
          {clampOgText(title, 60)}
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 34,
            color: '#c9c2cf',
            display: 'block',
            maxWidth: 560,
            overflow: 'hidden',
          }}
        >
          {clampOgText(subtitle, 90)}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 80,
          bottom: 64,
          fontSize: 32,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: '#8f8399',
        }}
      >
        {SITE_NAME}
      </div>
    </div>
  );
}

export function ogFallbackCard() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: BG,
        color: '#fafafa',
        fontFamily: 'sans-serif',
        fontSize: 120,
        fontWeight: 800,
        letterSpacing: '-0.04em',
      }}
    >
      {SITE_NAME}
    </div>
  );
}
