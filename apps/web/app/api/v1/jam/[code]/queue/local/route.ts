import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jamService } from '@/lib/jam';
import { resolveJamIdentity } from '@/lib/jam/jam-identity';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { SESSION_ID_MAX_LEN } from '@/lib/session-signing';
import { ForbiddenError, ConflictError, ValidationError } from '@vire/core';

// Файл живёт только в памяти вкладки-колонки — сюда приходит id из lib/party/local-files.ts
// и снапшот метаданных, которые клиент уже знает (имя файла, длительность из <audio>).
const schema = z.object({
  fileId: z.string().min(1).max(200),
  title: z.string().trim().min(1).max(300),
  durationSec: z.number().int().positive().nullable().optional(),
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
  const limit = await rateLimit(`jam-queue-local:${rlKey}`, 10, 60);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  const service = jamService();
  const codeResult = await service.resolveCode(code);
  if (!codeResult.ok) {
    const status = codeResult.error instanceof ValidationError ? 400 : 404;
    return NextResponse.json({ error: codeResult.error.message }, { status });
  }

  const result = await service.addExternalItem(codeResult.value.id, identity, {
    source: 'LOCAL',
    externalId: parsed.data.fileId,
    externalUrl: null,
    title: parsed.data.title,
    artistName: '',
    coverUrl: null,
    durationSec: parsed.data.durationSec ?? null,
  });

  if (!result.ok) {
    const status =
      result.error instanceof ForbiddenError ? 403 : result.error instanceof ConflictError ? 409 : result.error instanceof ValidationError ? 400 : 404;
    return NextResponse.json({ error: result.error.message }, { status });
  }

  return NextResponse.json(result.value, { status: 201 });
}
