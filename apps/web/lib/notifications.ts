import { DrizzleNotificationRepository } from '@vire/db';
import { NotificationService } from '@vire/core';
import { realtimePublisher } from './realtime';

export function notificationService() {
  return new NotificationService(new DrizzleNotificationRepository(), realtimePublisher);
}
