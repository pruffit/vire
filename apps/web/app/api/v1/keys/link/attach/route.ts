import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCaller } from '@/lib/caller';
import { attachLink } from '@/lib/link-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ linkId: z.string().uuid(), eaPub: z.string().regex(/^[A-Za-z0-9+/]{43}=$/) });

export async function POST(req: Request) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const ok = await attachLink(parsed.data.linkId, caller.id, parsed.data.eaPub);
  if (!ok) return NextResponse.json({ error: 'Link not pending' }, { status: 409 });

  return NextResponse.json({ ok: true });
}
