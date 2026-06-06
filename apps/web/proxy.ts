import { auth } from '@/auth';
import { NextResponse } from 'next/server';

const ADMIN_ROLES = new Set(['MODERATOR', 'ADMIN', 'SUPERADMIN']);
const PROTECTED_PREFIXES = ['/dashboard', '/settings', '/upload'];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/admin')) {
    if (!req.auth) {
      const signIn = new URL('/sign-in', req.nextUrl.origin);
      signIn.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(signIn);
    }
    if (!ADMIN_ROLES.has(req.auth.user.role)) {
      return NextResponse.redirect(new URL('/', req.nextUrl.origin));
    }
    return;
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (isProtected && !req.auth) {
    const signIn = new URL('/sign-in', req.nextUrl.origin);
    signIn.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signIn);
  }
});

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)'],
};
