/** Брендовые SVG-иконки провайдеров входа. */

export function YandexIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <rect width="24" height="24" rx="5" fill="#FC3F1D" />
      {/* Буква «Я»: левый столб + арка + ножка */}
      <path
        d="M6 19V5h5.2c2.5 0 4.1 1.6 4.1 4.1 0 1.7-.9 3.1-2.3 3.8L16 19h-2.4l-2.7-5.7H8v5.7H6zm2-7.6h3c1.3 0 2.1-.9 2.1-2.3 0-1.4-.8-2.2-2.1-2.2H8v4.5z"
        fill="white"
      />
    </svg>
  );
}

export function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function VKIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <rect width="24" height="24" rx="5" fill="#0077FF" />
      <path
        d="M12.8 16.3h1.1s.3 0 .5-.2c.1-.2.1-.5.1-.5s0-1.5.7-1.7c.7-.2 1.6 1.4 2.6 2.1.7.5 1.3.4 1.3.4l2.5 0s1.3-.1.7-1.1c-.1-.1-.4-.8-1.9-2.2-1.6-1.5-1.4-1.2.5-3.8 1.2-1.6 1.7-2.5 1.5-2.9-.2-.4-1-.3-1-.3l-2.8 0s-.2 0-.4.1c-.2.1-.3.3-.3.3s-.5 1.2-1.1 2.2c-1.3 2.2-1.8 2.3-2 2.2-.5-.3-.4-1.3-.4-1.9 0-2.1.3-3-.6-3.2-.3-.1-.5-.1-1.4-.1-1 0-1.9 0-2.4.2-.3.2-.6.5-.4.5.2 0 .6.1.9.4.3.4.3 1.3.3 1.3s.2 2.5-.4 2.8c-.4.2-.9-.2-2.1-2.2-.6-1-.1-2.1-1-2.1l-2.7 0s-.4 0-.6.2c-.2.2-.1.5-.1.5s2.1 5 4.6 7.5c2.2 2.3 4.7 2.2 4.7 2.2z"
        fill="white"
      />
    </svg>
  );
}

export function TelegramIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <rect width="24" height="24" rx="5" fill="#29A9EB" />
      <path
        d="M17.5 7L5 11.8l3.5 1.2 1.5 4.5 2-2.5 3.5 2.5 2-10.5z"
        fill="white"
        stroke="white"
        strokeWidth="0.3"
        strokeLinejoin="round"
      />
      <path d="M8.5 13l.6 3.5 1.9-2.4" fill="white" />
    </svg>
  );
}
