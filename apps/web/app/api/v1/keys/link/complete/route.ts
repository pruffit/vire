import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { completeLink } from '@/lib/link-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  linkId: z.string().uuid(),
  eaPub: z.string().regex(/^[A-Za-z0-9+/]{43}=$/),
  wrapped: z.string().min(1).max(200),
  nonce: z.string().min(1).max(64),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const { linkId, eaPub, wrapped, nonce } = parsed.data;
  const ok = await completeLink(linkId, session.user.id, eaPub, wrapped, nonce);
  if (!ok) return NextResponse.json({ error: 'Link not pending' }, { status: 409 });

  return NextResponse.json({ ok: true });
}
