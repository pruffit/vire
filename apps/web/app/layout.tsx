import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Geist, Geist_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from '@vire/i18n/messages';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@vire/i18n/config';
import { MotionProvider, REDUCE_MOTION_INIT_SCRIPT } from '@vire/ui/motion';
import { JamSessionProvider } from '@/components/jam/jam-session-provider';
import { PartyVideoDock } from '@/components/jam/party-video-dock';
import { auth } from '@/auth';
import { countUnseenIncomingCached, countUnreadMessagesCached } from '@/lib/listener-data';
import { PlayerWrapper } from '@/components/player/player-wrapper';
import { MobileTabBar } from '@/components/listener/mobile-tab-bar';
import { DeferredWidgets } from '@/components/deferred-widgets';
import { Toaster } from '@/components/toast';
import { E2eeBootstrap } from '@/components/chat/e2ee-bootstrap';
import { LinkApprove } from '@/components/chat/link-approve';
import { ChatEventsBridge } from '@/components/chat/chat-events-bridge';
import { Nav } from '@/components/nav';
import { ScrollState } from '@/components/scroll-state';
import { ScrollRestoration } from '@/components/scroll-restoration';
import { SitePresence } from '@/components/site-presence';
import { YandexMetrika } from '@/components/yandex-metrika';
import { fontVariables } from '@/lib/fonts';
import { SITE_URL, SITE_NAME, siteDescription, siteTitle, siteLocale, TITLE_TEMPLATE } from '@/lib/site';
import { localizedAlternates } from '@/lib/metadata';
import { getTranslator } from '@vire/i18n/translator';
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

// /admin и другие нелокализованные ветки не проходят через next-intl middleware —
// заголовка нет, остаёмся на дефолтной локали (см. proxy.ts). Тот же приём — в RootLayout ниже.
async function headerLocaleOrDefault(): Promise<Locale> {
  const requestHeaders = await headers();
  const headerLocale = requestHeaders.get('x-next-intl-locale');
  return headerLocale && isLocale(headerLocale) ? headerLocale : DEFAULT_LOCALE;
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await headerLocaleOrDefault();
  const [title, description, tSeo] = await Promise.all([
    siteTitle(locale),
    siteDescription(locale),
    getTranslator(locale, 'seo'),
  ]);
  const keywords = [...(tSeo.raw('keywords') as string[]), SITE_NAME];
  const alternates = localizedAlternates(locale, '/');

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: title,
      template: TITLE_TEMPLATE,
    },
    description,
    applicationName: SITE_NAME,
    keywords,
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: siteLocale(locale),
      url: alternates.canonical as string,
      title,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: { index: true, follow: true },
    appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: SITE_NAME },
    alternates,
    // явные icons, иначе Яндекс/Google не всегда подхватывают favicon в выдаче
    icons: {
      icon: [
        { url: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
        { url: '/favicon.ico', sizes: 'any' },
        { url: '/favicon-96x96.png', type: 'image/png', sizes: '96x96' },
        { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
        { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
      ],
      apple: '/apple-icon.png',
      shortcut: '/favicon.ico',
    },
    verification: {
      yandex: '6fdc9d6fa3807d7b',
      // подтверждение для Google Search Console
      ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
        ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
        : {}),
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  const userId = session?.user?.id;
  const [incomingCount, messagesUnread, locale] = await Promise.all([
    userId ? countUnseenIncomingCached(userId) : 0,
    userId ? countUnreadMessagesCached(userId) : 0,
    headerLocaleOrDefault(),
  ]);
  const messages = await getMessages(locale);

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fontVariables} h-full antialiased`}
    >
      {/* App-shell фиксированной высоты, единственная скролл-область (см. CLAUDE.md) */}
      <body className="h-full flex flex-col bg-background text-foreground font-sans overflow-clip">
        {/* ставит vire-reduce-motion на <html> до пейнта, чтобы CSS-анимации не мигнули */}
        <script dangerouslySetInnerHTML={{ __html: REDUCE_MOTION_INIT_SCRIPT }} />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-3 focus:left-3 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:ring-2 focus:ring-ring"
        >
          {messages.common.skipLink as string}
        </a>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <MotionProvider>
            <Nav />
            <ScrollState />
            <ScrollRestoration />
            <SitePresence />
            <JamSessionProvider>
              {/* suppressHydrationWarning: ScrollState вешает is-scrolling через classList напрямую */}
              <div id="main-content" suppressHydrationWarning className="flex-1 min-h-0 overflow-y-auto overflow-x-clip">
                {children}
              </div>
              <PartyVideoDock />
              <PlayerWrapper />
            </JamSessionProvider>
            <MobileTabBar incomingCount={incomingCount} messagesUnread={messagesUnread} />
            <DeferredWidgets userId={userId} />
            <Toaster />
            {userId && (
              <>
                <E2eeBootstrap userId={userId} />
                <LinkApprove viewerId={userId} />
                <ChatEventsBridge viewerId={userId} />
              </>
            )}
            <YandexMetrika />
          </MotionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
