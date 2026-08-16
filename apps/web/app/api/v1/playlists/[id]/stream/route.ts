import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { playlistService } from '@/lib/playlist';
import { subscribeChannel, playlistChannel } from '@/lib/realtime';
import { NotFoundError } from '@vire/core';
import { errorJson } from '@/lib/error-response';

export const runtime = 'nodejs';

const HEARTBEAT_MS = 25_000;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const result = await playlistService().assertStreamAccess(id, caller.id);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return errorJson(result.error, status);
  }
  const { version } = result.value;

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

      unsubscribe = subscribeChannel(playlistChannel(id), send);
      send({ type: 'playlist:snapshot', playlistId: id, version });

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
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
