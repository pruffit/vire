import { auth } from '@/auth';
import { markUserOnline } from '@/lib/presence';
import { subscribe } from '@/lib/realtime';

export const runtime = 'nodejs';

const HEARTBEAT_MS = 25_000;

/** Один SSE-стрим на пользователя: несёт и чат-события, и уведомления (различаются `type`). */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });
  const userId = session.user.id;

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

      unsubscribe = subscribe(userId, send);
      void markUserOnline(userId);
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
          void markUserOnline(userId);
        } catch {
          cleanup();
        }
      }, HEARTBEAT_MS);

      controller.enqueue(encoder.encode(': connected\n\n'));
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
