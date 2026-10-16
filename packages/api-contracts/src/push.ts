import { z } from 'zod';

// Форму подписки задаёт браузерный PushSubscription — повторяем её один в один,
// иначе клиенту пришлось бы перекладывать поля перед отправкой.
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});
export type PushSubscriptionRequest = z.infer<typeof pushSubscriptionSchema>;

export const pushUnsubscribeSchema = z.object({ endpoint: z.string().url() });
export type PushUnsubscribeRequest = z.infer<typeof pushUnsubscribeSchema>;
