import type { INotificationRepository, NotificationType, NotificationItem } from '@vire/core';
import {
  insertNotification, listNotifications, countUnreadNotifications, markAllNotificationsRead, markNotificationRead,
} from '../queries/notifications';

export class DrizzleNotificationRepository implements INotificationRepository {
  insert(userId: string, type: NotificationType, actorId: string | null, entityId: string | null): Promise<void> {
    return insertNotification(userId, type, actorId, entityId);
  }
  list(userId: string, limit: number): Promise<NotificationItem[]> { return listNotifications(userId, limit); }
  countUnread(userId: string): Promise<number> { return countUnreadNotifications(userId); }
  markAllRead(userId: string): Promise<void> { return markAllNotificationsRead(userId); }
  markRead(userId: string, id: string): Promise<void> { return markNotificationRead(userId, id); }
}
