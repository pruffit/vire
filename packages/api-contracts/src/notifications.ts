import { z } from 'zod';

export const notificationTypeSchema = z.enum(['FRIEND_REQUEST', 'FRIEND_ACCEPT', 'JAM_INVITE', 'PLAYLIST_COLLAB_JOIN']);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationSchema = z.object({
  id: z.string(),
  type: notificationTypeSchema,
  actorId: z.string().nullable(),
  actorName: z.string().nullable(),
  actorImage: z.string().nullable(),
  entityId: z.string().nullable(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
});
export type NotificationDTO = z.infer<typeof notificationSchema>;

export const notificationsResponseSchema = z.object({
  notifications: z.array(notificationSchema),
  unread: z.number(),
});
export type NotificationsResponse = z.infer<typeof notificationsResponseSchema>;

export const notifyUnsubscribeQuerySchema = z.object({
  uid: z.string().min(1).max(128),
  token: z.string().min(1).max(128),
});
export type NotifyUnsubscribeQuery = z.infer<typeof notifyUnsubscribeQuerySchema>;
