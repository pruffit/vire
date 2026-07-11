import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzleArtistRepository } from '@vire/db';
import { ACTIVE_ARTIST_COOKIE } from '@/lib/active-artist';
import { isUuid } from '@/lib/upload';

// Проверяем владение артистом, кладём id в cookie: дальше все dashboard-операции резолвятся на него.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { artistId?: string };
  if (!body.artistId || !isUuid(body.artistId)) {
    return NextResponse.json({ error: 'Invalid artistId' }, { status: 400 });
  }

  const artist = await new DrizzleArtistRepository(db).findByIdForUser(body.artistId, session.user.id);
  if (!artist) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const res = NextResponse.json({ ok: true, artistId: artist.id, slug: artist.slug });
  res.cookies.set(ACTIVE_ARTIST_COOKIE, artist.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
