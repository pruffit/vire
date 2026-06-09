import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { getAggregateMoments, addFavoriteMoment, trackExists } from '@vire/db';

type Params = { params: Promise<{ id: string }> };

const momentSchema = z.object({
  positionSec: z.number().int().min(0).max(86400),
});

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  if (!(await trackExists(id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const moments = await getAggregateMoments(id);
  return NextResponse.json({ moments });
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  if (!(await trackExists(id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = momentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const session = await auth();
  await addFavoriteMoment(id, parsed.data.positionSec, session?.user?.id);
  return NextResponse.json({ ok: true });
}
