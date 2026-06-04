import { auth } from '@/auth';
import { NextResponse } from 'next/server';

const PROTECTED_PREFIXES = ['/dashboard', '/settings', '/upload'];

export default auth((req) => {
  const { pathname } = req.nextUrl;
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
