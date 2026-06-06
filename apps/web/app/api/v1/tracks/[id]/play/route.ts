import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { playEventQueue } from '@/lib/queue';

const VALID_SOURCES = new Set(['direct', 'playlist', 'feed', 'search']);

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id: trackId } = await params;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const { sessionId, source, durationPlayedSec, startedAt } = body as Record<string, unknown>;

  if (
    typeof sessionId !== 'string' || sessionId.length < 1 || sessionId.length > 64 ||
    typeof durationPlayedSec !== 'number' || !Number.isInteger(durationPlayedSec) || durationPlayedSec < 0 ||
    typeof startedAt !== 'string' || isNaN(Date.parse(startedAt))
  ) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const resolvedSource = typeof source === 'string' && VALID_SOURCES.has(source) ? source : 'direct';

  const session = await auth();

  await playEventQueue.add({
    trackId,
    sessionId,
    userId: session?.user?.id ?? null,
    source: resolvedSource,
    durationPlayedSec,
    startedAt,
  });

  return NextResponse.json({ ok: true });
}
