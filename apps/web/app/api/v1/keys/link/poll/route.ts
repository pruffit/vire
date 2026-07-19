import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { getLink } from '@/lib/link-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ linkId: z.string().uuid() });

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = schema.safeParse({ linkId: new URL(req.url).searchParams.get('linkId') });
  if (!parsed.success) return NextResponse.json({ error: 'Invalid linkId' }, { status: 400 });

  const state = await getLink(parsed.data.linkId, session.user.id);
  if (!state) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(state);
}
