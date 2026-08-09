import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jamService } from '@/lib/jam';
import { externalResolveService } from '@/lib/external';
import { resolveJamIdentity } from '@/lib/jam/jam-identity';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { SESSION_ID_MAX_LEN } from '@/lib/session-signing';
import { ForbiddenError, ConflictError, ValidationError } from '@vire/core';
import { errorJson } from '@/lib/error-response';

const schema = z.object({
  input: z.string().min(1).max(500),
  sessionId: z.string().max(SESSION_ID_MAX_LEN).optional(),
});

type Ctx = { params: Promise<{ code: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { code } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const identity = await resolveJamIdentity(parsed.data.sessionId);
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rlKey = 'userId' in identity ? identity.userId : identity.guestSessionId;
  const limit = await rateLimit(`jam-queue-external:${rlKey}`, 30, 60);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  const service = jamService();
  const codeResult = await service.resolveCode(code);
  if (!codeResult.ok) {
    const status = codeResult.error instanceof ValidationError ? 400 : 404;
    return errorJson(codeResult.error, status);
  }

  // Участие и режим проверяются ДО резолва: он ходит в сеть и жжёт квоту поиска —
  // непричастный не должен доводить дело до внешнего запроса.
  if (codeResult.value.kind !== 'PARTY') {
    return NextResponse.json({ error: 'Внешние треки доступны только в режиме вечеринки', code: 'jam.partyOnlyExternalTracks' }, { status: 400 });
  }
  const membership = await service.assertParticipant(codeResult.value.id, identity);
  if (!membership.ok) return errorJson(membership.error, 403);

  const outcome = await externalResolveService().resolve(parsed.data.input);
  if (outcome.outcome === 'candidates') {
    return NextResponse.json({ candidates: outcome.candidates });
  }

  const result =
    outcome.outcome === 'vire'
      ? await service.mutateQueue(codeResult.value.id, identity, { kind: 'add', trackId: outcome.trackId })
      : await service.addExternalItem(codeResult.value.id, identity, outcome.ref);

  if (!result.ok) {
    const status =
      result.error instanceof ForbiddenError ? 403 : result.error instanceof ConflictError ? 409 : result.error instanceof ValidationError ? 400 : 404;
    return errorJson(result.error, status);
  }

  return NextResponse.json(result.value, { status: 201 });
}
