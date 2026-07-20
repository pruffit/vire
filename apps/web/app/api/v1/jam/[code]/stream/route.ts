import { NextResponse } from 'next/server';
import { jamService } from '@/lib/jam';
import { resolveJamIdentity } from '@/lib/jam/jam-identity';
import { subscribeChannel, jamChannel } from '@/lib/realtime';
import { ForbiddenError, ValidationError } from '@vire/core';

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
    return NextResponse.json({ error: codeResult.error.message }, { status });
  }
  const jamId = codeResult.value.id;

  const sessionId = new URL(req.url).searchParams.get('sessionId') ?? undefined;
  const identity = await resolveJamIdentity(sessionId);
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const stateResult = await service.getState(jamId, identity);
  if (!stateResult.ok) {
    const status = stateResult.error instanceof ForbiddenError ? 403 : 404;
    return NextResponse.json({ error: stateResult.error.message }, { status });
  }
  const { session, participants, queue, playback } = stateResult.value;

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  function cleanup() {
    unsubscribe?.();
    unsubscribe = null;
    if (heartbeat) clearInterval(heartbeat);
  }

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
      send({ type: 'jam:snapshot', session, participants, queue, version: session.queueVersion, playback });
      void service.heartbeat(jamId, identity);

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
