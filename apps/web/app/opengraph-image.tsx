import { ImageResponse } from 'next/og';
import { SITE_NAME, SITE_DESCRIPTION } from '@/lib/site';

// Дефолтная OG-картинка платформы. Применяется как fallback ко всем маршрутам,
// которые не задают свою openGraph.images (главная, /artists, артисты без аватара).
// Раньше у этих страниц ogImage был пустым → seoStatus: error в аудите.
export const runtime = 'nodejs';
export const alt = `${SITE_NAME} — независимая музыкальная площадка`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
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
          {SITE_DESCRIPTION}
        </div>
      </div>
    ),
    { ...size },
  );
}
