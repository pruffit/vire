import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzleArtistRepository, DrizzleFollowRepository } from '@vire/db';
import { FollowService, NotFoundError } from '@vire/core';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

type Ctx = { params: Promise<{ slug: string }> };

function followService() {
  return new FollowService(new DrizzleArtistRepository(db), new DrizzleFollowRepository(db));
}

export async function POST(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = await rateLimit(`follow:${session.user.id}`, 30, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const { slug } = await params;
  const result = await followService().follow(session.user.id, slug);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return NextResponse.json({ error: status === 404 ? 'Not found' : 'Forbidden' }, { status });
  }
  return NextResponse.json({ following: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug } = await params;
  const result = await followService().unfollow(session.user.id, slug);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return NextResponse.json({ error: status === 404 ? 'Not found' : 'Forbidden' }, { status });
  }
  return NextResponse.json({ following: false });
}
