import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { friendshipService } from '@/lib/friends';

type Ctx = { params: Promise<{ userId: string }> };

// decline/cancel/unfriend — одно и то же удаление ребра; сервис не различает по контракту REST.
export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { userId } = await params;
  await friendshipService().unfriend(session.user.id, userId);
  return NextResponse.json({ ok: true });
}
