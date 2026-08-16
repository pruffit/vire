import { NextResponse } from 'next/server';
import { PLAY_SOURCES } from '@vire/api-contracts';
import { getCaller } from '@/lib/caller';
import { playEventQueue } from '@/lib/queue';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';
import { verifySessionId, SESSION_ID_MAX_LEN } from '@/lib/session-signing';

const VALID_SOURCES = new Set<string>(PLAY_SOURCES);

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const rl = await rateLimit(clientKey(req, 'play'), 40, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const { id: trackId } = await params;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const { sessionId, source, durationPlayedSec, startedAt } = body as Record<string, unknown>;

  if (
    typeof sessionId !== 'string' || sessionId.length < 1 || sessionId.length > SESSION_ID_MAX_LEN ||
    typeof durationPlayedSec !== 'number' || !Number.isInteger(durationPlayedSec) || durationPlayedSec < 0 ||
    typeof startedAt !== 'string' || isNaN(Date.parse(startedAt))
  ) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const verifiedSessionId = verifySessionId(sessionId);
  if (!verifiedSessionId) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const resolvedSource = typeof source === 'string' && VALID_SOURCES.has(source) ? source : 'direct';

  const caller = await getCaller();

  await playEventQueue.add({
    trackId,
    sessionId: verifiedSessionId,
    userId: caller?.id ?? null,
    source: resolvedSource,
    durationPlayedSec,
    startedAt,
  });

  return NextResponse.json({ ok: true });
}
