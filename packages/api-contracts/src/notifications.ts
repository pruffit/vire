import { z } from 'zod';

// Открытый список: набор типов держит реестр в @vire/core, клиент обязан пережить
// незнакомый тип, а не падать на нём (иначе новый тип = синхронный релиз всех клиентов).
export const notificationTypeSchema = z.string().min(1).max(64);
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
