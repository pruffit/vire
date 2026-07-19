import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { friendshipService, userDirectoryService } from '@/lib/friends';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';

const RESULT_LIMIT = 10;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(clientKey(req, 'user-search'), 30, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? '';
  const viewerId = session.user.id;

  const searchResult = await userDirectoryService().search(q, viewerId, RESULT_LIMIT);
  const hits = searchResult.ok ? searchResult.value : [];
  const statuses = await friendshipService().getStatuses(viewerId, hits.map((h) => h.id));

  return NextResponse.json({
    results: hits.map((h) => ({ id: h.id, name: h.name, image: h.image, status: statuses.get(h.id) ?? 'NONE' })),
  });
}
