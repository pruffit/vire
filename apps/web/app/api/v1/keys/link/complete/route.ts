import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCaller } from '@/lib/caller';
import { completeLink } from '@/lib/link-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  linkId: z.string().uuid(),
  wrapped: z.string().min(1).max(200),
  nonce: z.string().min(1).max(64),
});

export async function POST(req: Request) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const { linkId, wrapped, nonce } = parsed.data;
  const ok = await completeLink(linkId, caller.id, wrapped, nonce);
  if (!ok) return NextResponse.json({ error: 'Link not pending' }, { status: 409 });

  return NextResponse.json({ ok: true });
}
