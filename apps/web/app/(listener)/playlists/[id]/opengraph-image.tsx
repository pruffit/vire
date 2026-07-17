import { ImageResponse } from 'next/og';
import { getPlaylistWithTracks, getUserProfile } from '@vire/db';
import { SITE_NAME } from '@/lib/site';
import { pluralTracks } from '@/lib/format';
import { getHeaderCovers } from './header-cover';

export const runtime = 'nodejs';
export const alt = `Плейлист на ${SITE_NAME}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 300;

const BG = 'radial-gradient(ellipse 90% 80% at 50% 0%, #2a2030, #141414)';
const CACHE_HEADERS = { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' };

function fallbackImage() {
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

export default async function PlaylistOgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const playlist = await getPlaylistWithTracks(id);

  // OG-роут публичный и сессии не видит: приватный плейлист не отдаёт ни названия, ни обложек.
  if (!playlist || playlist.visibility !== 'PUBLIC') {
    return new ImageResponse(fallbackImage(), { ...size, headers: CACHE_HEADERS });
  }

  const covers = getHeaderCovers(playlist);
  const owner = playlist.ownerUserId ? await getUserProfile(playlist.ownerUserId) : null;
  const authorName = owner?.name ?? SITE_NAME;
  const count = playlist.tracks.length;
  const mosaic = covers.length >= 4 ? covers.slice(0, 4) : [];
  const single = mosaic.length === 0 ? covers[0] ?? null : null;

  return new ImageResponse(
    (
      <div
        style={{
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
        <div
          style={{
            width: 400,
            height: 400,
            display: 'flex',
            flexWrap: 'wrap',
            borderRadius: 24,
            overflow: 'hidden',
            background: '#221c26',
          }}
        >
          {mosaic.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" width={200} height={200} style={{ objectFit: 'cover' }} />
          ))}
          {single && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={single} alt="" width={400} height={400} style={{ objectFit: 'cover' }} />
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ fontSize: 26, letterSpacing: '0.18em', color: '#a79bb0' }}>ПЛЕЙЛИСТ</div>
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
            {playlist.title}
          </div>
          <div style={{ marginTop: 28, fontSize: 34, color: '#c9c2cf' }}>
            {authorName} · {count} {pluralTracks(count)}
          </div>
          <div style={{ marginTop: 44, fontSize: 30, fontWeight: 700, color: '#fafafa' }}>{SITE_NAME}</div>
        </div>
      </div>
    ),
    { ...size, headers: CACHE_HEADERS },
  );
}
