'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5rem',
          padding: '1.5rem',
          textAlign: 'center',
          background: 'oklch(10% 0.01 270)',
          color: 'oklch(90% 0.01 270)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <p
          style={{
            fontSize: '6rem',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            fontFamily: 'monospace',
            opacity: 0.08,
            lineHeight: 1,
            margin: 0,
          }}
        >
          500
        </p>
        <div style={{ marginTop: '-2rem' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
            Что-то пошло не так
          </h1>
          <p style={{ fontSize: '0.875rem', opacity: 0.5, margin: 0, maxWidth: '280px' }}>
            Произошла критическая ошибка. Попробуй обновить страницу.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={reset}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '9999px',
              background: 'oklch(90% 0.01 270)',
              color: 'oklch(10% 0.01 270)',
              fontSize: '0.875rem',
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Попробовать снова
          </button>
          <a
            href="/"
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '9999px',
              border: '1px solid oklch(30% 0.01 270)',
              color: 'oklch(70% 0.01 270)',
              fontSize: '0.875rem',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            На главную
          </a>
        </div>
      </body>
    </html>
  );
}
