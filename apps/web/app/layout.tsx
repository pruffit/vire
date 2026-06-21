import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { MotionProvider } from '@vire/ui/motion';
import { PlayerWrapper } from '@/components/player/player-wrapper';
import { CommandPalette } from '@/components/command-palette';
import { Toaster } from '@/components/toast';
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { CookieBanner } from '@/components/cookie-banner';
import { Announcements } from '@/components/announcements';
import { EasterEggs } from '@/components/easter-eggs';
import { ScrollState } from '@/components/scroll-state';
import { ScrollRestoration } from '@/components/scroll-restoration';
import { YandexMetrika } from '@/components/yandex-metrika';
import { fontVariables } from '@/lib/fonts';
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, SITE_TITLE } from '@/lib/site';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ['музыка', 'артисты', 'релизы', 'СНГ', 'инди', 'независимая музыка', SITE_NAME],
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'ru_RU',
    url: '/',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
  // Явные иконки, чтобы Яндекс/Google гарантированно подхватили favicon в выдаче
  // (в поиске иконка не показывалась). Файлы лежат в app/ и public/.
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: '/apple-icon.png',
    shortcut: '/favicon.ico',
  },
  verification: {
    yandex: '6fdc9d6fa3807d7b',
    // Google Search Console: задаётся через env, чтобы подтвердить сайт и начать
    // индексацию в Google (сейчас сайт там не индексируется).
    ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
      ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
      : {}),
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} ${fontVariables} h-full antialiased`}
    >
      {/*
        App-shell: окно фиксированной высоты (h-full + overflow-hidden), скролла
        на уровне документа нет. Nav закреплён сверху, контент скроллится внутри
        единой области ниже. Плеер (элемент потока, см. PlayerWrapper) занимает
        место только когда играет трек, поэтому постоянной «полосы» под плеер нет.
        Страницы заполняют область через min-h-full (НЕ min-h-screen: иначе высота
        Nav давала бы лишний скролл).
      */}
      <body className="h-full flex flex-col bg-background text-foreground font-sans overflow-hidden">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-3 focus:left-3 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:ring-2 focus:ring-ring"
        >
          К содержимому
        </a>
        <MotionProvider>
          <Nav />
          <ScrollState />
          <ScrollRestoration />
          <div id="main-content" className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            {/* Flex-обёртка внутри scroll-area прибивает футер вниз на коротких страницах.
                Сама scroll-area остаётся plain block — иначе min-h-full страниц
                сжимается флексом и скролл ломается. */}
            <div className="min-h-full flex flex-col">
              <div className="flex-1">{children}</div>
              <Footer />
            </div>
          </div>
          <PlayerWrapper />
          <CommandPalette />
          <KeyboardShortcuts />
          <Toaster />
          <CookieBanner />
          <Announcements />
          <EasterEggs />
          <YandexMetrika />
        </MotionProvider>
      </body>
    </html>
  );
}
