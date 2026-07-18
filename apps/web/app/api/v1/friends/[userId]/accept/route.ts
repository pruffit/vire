import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { friendshipService } from '@/lib/friends';
import { NotFoundError } from '@vire/core';

type Ctx = { params: Promise<{ userId: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { userId } = await params;
  const result = await friendshipService().accept(session.user.id, userId);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return NextResponse.json({ error: status === 404 ? 'Not found' : 'Forbidden' }, { status });
  }
  return NextResponse.json({ ok: true });
}
