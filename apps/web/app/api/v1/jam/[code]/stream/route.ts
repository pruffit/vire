import { NextResponse } from 'next/server';
import { jamService } from '@/lib/jam';
import { resolveJamIdentity } from '@/lib/jam/jam-identity';
import { subscribeChannel, publishChannel, jamChannel } from '@/lib/realtime';
import { ForbiddenError, ValidationError } from '@vire/core';
import { errorJson } from '@/lib/error-response';

export const runtime = 'nodejs';

const HEARTBEAT_MS = 25_000;

type Ctx = { params: Promise<{ code: string }> };

/** Доступ по членству в комнате, не по аккаунту — гость входит по подписанному sessionId. */
export async function GET(req: Request, { params }: Ctx) {
  const { code } = await params;
  const service = jamService();

  const codeResult = await service.resolveCode(code);
  if (!codeResult.ok) {
    const status = codeResult.error instanceof ValidationError ? 400 : 404;
    return errorJson(codeResult.error, status);
  }
  const jamId = codeResult.value.id;

  const sessionId = new URL(req.url).searchParams.get('sessionId') ?? undefined;
  const identity = await resolveJamIdentity(sessionId);
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const stateResult = await service.getState(jamId, identity);
  if (!stateResult.ok) {
    const status = stateResult.error instanceof ForbiddenError ? 403 : 404;
    return errorJson(stateResult.error, status);
  }
  const { session, participants, queue, playback, presentParticipantIds } = stateResult.value;

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  // Arrow-выражение, не function-декларация: только так TS удерживает narrowing
  // `identity` (не null после гарда выше) внутри тела — hoisted-декларации его теряют.
  const cleanup = () => {
    unsubscribe?.();
    unsubscribe = null;
    if (heartbeat) clearInterval(heartbeat);
    void service.leave(jamId, identity).catch(() => {});
  };

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // controller уже закрыт клиентом
        }
      };

      unsubscribe = subscribeChannel(jamChannel(jamId), send);
      send({ type: 'jam:snapshot', session, participants, queue, version: session.queueVersion, playback, presentParticipantIds });
      // Только на входе в живое соединение — участник реально становится звуковым устройством,
      // остальным нужно узнать об этом сразу, а не ждать следующего периодического heartbeat.
      void service.heartbeat(jamId, identity).then(async () => {
        const ids = await service.listPresent(jamId);
        await publishChannel(jamChannel(jamId), { type: 'jam:presence', participantIds: ids });
      });

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
          void service.heartbeat(jamId, identity);
        } catch {
          cleanup();
        }
      }, HEARTBEAT_MS);
    },
    cancel() {
      cleanup();
    },
  });

  req.signal.addEventListener('abort', cleanup);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
