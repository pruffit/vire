import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';
import { getPathname } from '@/i18n/navigation';
import { LOCALES, DEFAULT_LOCALE, type Locale } from '@vire/i18n/config';
import { can } from '@vire/core/access';

const handleI18nRouting = createMiddleware(routing);

const PROTECTED_PREFIXES = ['/dashboard', '/settings', '/upload'];

function stripLocale(pathname: string): { locale: Locale; rest: string } {
  for (const locale of LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return { locale, rest: pathname.slice(1 + locale.length) || '/' };
    }
  }
  return { locale: DEFAULT_LOCALE, rest: pathname };
}

// Нелокализованные ветки живут только на корне: /en/admin — мёртвый URL, а не 404.
const UNLOCALIZED_PREFIXES = ['/admin', '/fwqa688', '/desktop', '/mobile-auth-bridge'];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const { locale: urlLocale, rest: unprefixed } = stripLocale(pathname);
  if (urlLocale !== DEFAULT_LOCALE && UNLOCALIZED_PREFIXES.some((p) => unprefixed.startsWith(p))) {
    const target = new URL(unprefixed, req.nextUrl.origin);
    target.search = req.nextUrl.search;
    return NextResponse.redirect(target);
  }

  // /admin не локализуется — в next-intl middleware не заходит, гейт как раньше.
  if (pathname.startsWith('/admin')) {
    if (!req.auth) {
      const signIn = new URL('/sign-in', req.nextUrl.origin);
      signIn.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(signIn);
    }
    if (!can(req.auth.user, 'admin.panel.view')) {
      return NextResponse.redirect(new URL('/', req.nextUrl.origin));
    }
    return NextResponse.next();
  }

  // Секретный вход в режим "вечеринка" — тоже вне локализации.
  if (pathname.startsWith('/fwqa688')) {
    return NextResponse.next();
  }

  // Веб-мост входа мобильного приложения — top-level страница, гейт сессии делает сама
  // страница (redirect на /sign-in), next-intl её трогать не должен. Без chrome: это голый
  // экран внутри WebBrowser.openAuthSessionAsync — cookie-баннер/анонсы/Nav тут не к месту.
  if (pathname.startsWith('/mobile-auth-bridge')) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-desktop-chrome', 'none');
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Окно мини-плеера десктоп-клиента (Tauri) — top-level страница без chrome,
  // тоже вне локализации. Заголовок читает app/layout.tsx — не монтирует
  // Nav/PlayerWrapper/etc (см. docs/superpowers/specs/2026-08-17-desktop-mini-player-design.md).
  if (pathname.startsWith('/desktop/mini-player')) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-desktop-chrome', 'none');
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => unprefixed.startsWith(p));
  if (isProtected && !req.auth) {
    const signIn = new URL(getPathname({ href: '/sign-in', locale: urlLocale }), req.nextUrl.origin);
    signIn.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signIn);
  }

  // Next прогоняет proxy повторно на внутреннем rewrite next-intl (`/` → `/ru`): второй
  // заход канонизировал бы `/ru` → `/` редиректом и зациклил его. Заголовок ставит
  // next-intl, снаружи он ничего не даёт — auth-гейты выше уже отработали.
  if (req.headers.get('x-next-intl-locale')) return NextResponse.next();

  // /sign-in?chrome=none — редирект из /mobile-auth-bridge (embedded-браузер мобильного
  // моста входа): мутируем req.headers ДО next-intl, чтобы x-desktop-chrome доехал через
  // её собственный rewrite/next() до app/layout.tsx (тот же приём, что у mini-player).
  if (req.nextUrl.searchParams.get('chrome') === 'none') {
    req.headers.set('x-desktop-chrome', 'none');
  }

  return handleI18nRouting(req);
});

export const config = {
  // /admin проходит выше (нужен гейт), но не доходит до intl-обработки; статика/api/
  // секретный вход/сайтмапы исключены — не локализуются, next-intl их не должен трогать.
  matcher: ['/((?!api|_next|fwqa688|opengraph-image|sitemaps|.*\\..*).*)'],
};
