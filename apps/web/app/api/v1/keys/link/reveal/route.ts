import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { revealLink } from '@/lib/link-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ linkId: z.string().uuid(), ebPub: z.string().regex(/^[A-Za-z0-9+/]{43}=$/) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const ok = await revealLink(parsed.data.linkId, session.user.id, parsed.data.ebPub);
  if (!ok) return NextResponse.json({ error: 'Link not ready' }, { status: 409 });

  return NextResponse.json({ ok: true });
}
