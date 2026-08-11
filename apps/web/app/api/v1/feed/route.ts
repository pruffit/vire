import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { DrizzleFeedRepository } from '@vire/db';
import { FeedService, type RankedFeedItem } from '@vire/core';
import { type FeedResponse } from '@vire/api-contracts';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

function toResponse(items: RankedFeedItem[]): FeedResponse {
  return { items: items.map((item) => ({ ...item, occurredAt: item.occurredAt.toISOString() })) };
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const service = new FeedService(new DrizzleFeedRepository(), Date.now);
  const items = await service.getFeed({ userId: session.user.id, limit: parsed.data.limit });

  return NextResponse.json(toResponse(items));
}
