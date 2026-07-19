import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { notificationService } from '@/lib/notifications';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await notificationService().markAllRead(session.user.id);
  return NextResponse.json({ ok: true });
}
