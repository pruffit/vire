import { ImageResponse } from 'next/og';
import { SITE_NAME, siteDescription } from '@/lib/site';

// fallback OG-картинка для маршрутов без своей openGraph.images — вне app/[locale],
// запрос без определённой локали (см. app/manifest.ts) — фолбэк на дефолтную (ru).
export const runtime = 'nodejs';
export const alt = `${SITE_NAME} — независимая музыкальная площадка`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  const description = await siteDescription();
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '90px',
          background:
            'radial-gradient(ellipse 90% 80% at 50% 0%, #2a2030, #141414)',
          color: '#fafafa',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 140,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            lineHeight: 1,
          }}
        >
          {SITE_NAME}
        </div>
        <div
          style={{
            marginTop: 36,
            fontSize: 46,
            fontWeight: 500,
            color: '#c9c2cf',
            maxWidth: 900,
            lineHeight: 1.2,
          }}
        >
          {description}
        </div>
      </div>
    ),
    { ...size },
  );
}
