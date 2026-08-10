import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';
import { getPathname } from '@/i18n/navigation';
import { LOCALES, DEFAULT_LOCALE, type Locale } from '@vire/i18n/config';

const handleI18nRouting = createMiddleware(routing);

const ADMIN_ROLES = new Set(['VIEWER', 'MODERATOR', 'ADMIN', 'SUPERADMIN']);
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
const UNLOCALIZED_PREFIXES = ['/admin', '/fwqa688'];

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
    if (!ADMIN_ROLES.has(req.auth.user.role)) {
      return NextResponse.redirect(new URL('/', req.nextUrl.origin));
    }
    return NextResponse.next();
  }

  // Секретный вход в режим "вечеринка" — тоже вне локализации.
  if (pathname.startsWith('/fwqa688')) {
    return NextResponse.next();
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

  return handleI18nRouting(req);
});

export const config = {
  // /admin проходит выше (нужен гейт), но не доходит до intl-обработки; статика/api/
  // секретный вход/сайтмапы исключены — не локализуются, next-intl их не должен трогать.
  matcher: ['/((?!api|_next|fwqa688|opengraph-image|sitemaps|.*\\..*).*)'],
};
