import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { NotFoundError } from '@vire/core';
import { playlistService } from '@/lib/playlist';

type Params = { params: Promise<{ id: string; userId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, userId } = await params;
  const result = await playlistService().kick(id, session.user.id, userId);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return NextResponse.json({ error: status === 404 ? 'Not found' : 'Forbidden' }, { status });
  }
  return NextResponse.json({ ok: true });
}
