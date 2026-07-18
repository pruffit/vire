import type { INotificationRepository, NotificationType, NotificationItem } from '../repositories/notification';
import type { RealtimePublisher } from '../ports/realtime';

export class NotificationService {
  constructor(
    private readonly repo: INotificationRepository,
    private readonly publisher: RealtimePublisher,
  ) {}

  async notify(userId: string, type: NotificationType, actorId: string | null, entityId: string | null): Promise<void> {
    await this.repo.insert(userId, type, actorId, entityId);
    await this.publisher.publish(userId, { type: 'notification', notificationType: type, actorId, entityId });
  }

  list(userId: string, limit: number): Promise<NotificationItem[]> { return this.repo.list(userId, limit); }
  countUnread(userId: string): Promise<number> { return this.repo.countUnread(userId); }
  markAllRead(userId: string): Promise<void> { return this.repo.markAllRead(userId); }
  markRead(userId: string, id: string): Promise<void> { return this.repo.markRead(userId, id); }
}
