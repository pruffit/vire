import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { likeTrack, unlikeTrack, trackExists } from '@vire/db';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!(await trackExists(id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await likeTrack(session.user.id, id);
  return NextResponse.json({ liked: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await unlikeTrack(session.user.id, id);
  return NextResponse.json({ liked: false });
}
