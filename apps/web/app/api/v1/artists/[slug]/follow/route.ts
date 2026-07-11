import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzleArtistRepository, followArtist, unfollowArtist } from '@vire/db';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

type Ctx = { params: Promise<{ slug: string }> };

async function resolveArtist(slug: string) {
  return new DrizzleArtistRepository(db).findBySlug(slug);
}

export async function POST(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = await rateLimit(`follow:${session.user.id}`, 30, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const { slug } = await params;
  const artist = await resolveArtist(slug);
  if (!artist) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await followArtist(session.user.id, artist.id);
  return NextResponse.json({ following: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug } = await params;
  const artist = await resolveArtist(slug);
  if (!artist) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await unfollowArtist(session.user.id, artist.id);
  return NextResponse.json({ following: false });
}
