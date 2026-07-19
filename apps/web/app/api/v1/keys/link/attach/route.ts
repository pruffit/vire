import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { attachLink } from '@/lib/link-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ linkId: z.string().uuid(), eaPub: z.string().regex(/^[A-Za-z0-9+/]{43}=$/) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const ok = await attachLink(parsed.data.linkId, session.user.id, parsed.data.eaPub);
  if (!ok) return NextResponse.json({ error: 'Link not pending' }, { status: 409 });

  return NextResponse.json({ ok: true });
}
