import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { startLink } from '@/lib/link-session';
import { publish } from '@/lib/realtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ ebPub: z.string().regex(/^[A-Za-z0-9+/]{43}=$/) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid ebPub' }, { status: 400 });

  const linkId = await startLink(session.user.id, parsed.data.ebPub);
  if (!linkId) return NextResponse.json({ error: 'Link unavailable' }, { status: 503 });

  await publish(session.user.id, { type: 'link-request', linkId });
  return NextResponse.json({ linkId });
}
