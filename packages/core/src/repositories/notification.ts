export type NotificationType = 'FRIEND_REQUEST' | 'FRIEND_ACCEPT';

export type NotificationItem = {
  id: string;
  type: NotificationType;
  actorId: string | null;
  actorName: string | null;
  actorImage: string | null;
  entityId: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export interface INotificationRepository {
  insert(userId: string, type: NotificationType, actorId: string | null, entityId: string | null): Promise<void>;
  list(userId: string, limit: number): Promise<NotificationItem[]>;
  countUnread(userId: string): Promise<number>;
  markAllRead(userId: string): Promise<void>;
  markRead(userId: string, id: string): Promise<void>;
}
