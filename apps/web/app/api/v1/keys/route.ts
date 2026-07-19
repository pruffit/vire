import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { upsertIdentityKey, getIdentityKey } from '@vire/db';

const postSchema = z.object({ ikPub: z.string().regex(/^[A-Za-z0-9+/]{43}=$/) });
const getSchema = z.object({ userId: z.string().uuid() });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid ikPub' }, { status: 400 });

  await upsertIdentityKey(session.user.id, parsed.data.ikPub);
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = getSchema.safeParse({ userId: new URL(req.url).searchParams.get('userId') });
  if (!parsed.success) return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });

  return NextResponse.json({ ikPub: await getIdentityKey(parsed.data.userId) });
}
