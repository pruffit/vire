import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { db, DrizzleArtistRepository, DrizzleFollowRepository } from '@vire/db';
import { FollowService, NotFoundError } from '@vire/core';
import type { FollowResponse } from '@vire/api-contracts';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { errorJson } from '@/lib/error-response';

type Ctx = { params: Promise<{ slug: string }> };

function followService() {
  return new FollowService(new DrizzleArtistRepository(db), new DrizzleFollowRepository(db));
}

export async function POST(_req: Request, { params }: Ctx) {
  const caller = await getCaller();
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = await rateLimit(`follow:${caller.id}`, 30, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const { slug } = await params;
  const result = await followService().follow(caller.id, slug);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return errorJson(result.error, status);
  }
  return NextResponse.json({ following: true } satisfies FollowResponse);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const caller = await getCaller();
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug } = await params;
  const result = await followService().unfollow(caller.id, slug);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return errorJson(result.error, status);
  }
  return NextResponse.json({ following: false } satisfies FollowResponse);
}
