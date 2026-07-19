import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { notificationService } from '@/lib/notifications';

const LIST_LIMIT = 20;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const svc = notificationService();
  const [notifications, unread] = await Promise.all([
    svc.list(session.user.id, LIST_LIMIT),
    svc.countUnread(session.user.id),
  ]);
  return NextResponse.json({ notifications, unread });
}
