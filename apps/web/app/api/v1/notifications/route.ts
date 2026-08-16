import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { notificationService } from '@/lib/notifications';
import type { NotificationItem } from '@vire/core';
import type { NotificationsResponse } from '@vire/api-contracts';

const LIST_LIMIT = 20;

function toResponse(notifications: NotificationItem[], unread: number): NotificationsResponse {
  return {
    notifications: notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString(), readAt: n.readAt ? n.readAt.toISOString() : null })),
    unread,
  };
}

export async function GET() {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const svc = notificationService();
  const [notifications, unread] = await Promise.all([
    svc.list(caller.id, LIST_LIMIT),
    svc.countUnread(caller.id),
  ]);
  return NextResponse.json(toResponse(notifications, unread));
}
