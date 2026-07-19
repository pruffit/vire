import { Worker, type Job } from 'bullmq';
import { QUEUE_NOTIFY_EXTERNAL, type ExternalNotifyJobData, decideExternalDelivery, friendRequestEmail, chatMessageEmail } from '@vire/core';
import { signNotifyUnsub } from '@vire/core/notifications/unsubscribe'; // субпуть: node:crypto не в edge-safe корневом barrel (Task 15)
import { getUserNotifyContext, getUserDisplayName, listPushSubscriptions, deletePushSubscriptionsByEndpoints } from '@vire/db';
import { connection } from '../queues/connection.js';
import { sendBrevoEmail } from '../lib/brevo.js';
import { sendPush } from '../lib/webpush.js';
import { isUserOnline } from '../lib/user-presence.js';
import { chatEmailDebounced } from '../lib/notify-debounce.js';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const SIGNING_SECRET = process.env.LINK_SIGNING_SECRET || process.env.AUTH_SECRET || null;

export async function handle(job: Job<ExternalNotifyJobData>): Promise<void> {
  const { kind, recipientId, actorId, conversationId } = job.data;

  const ctx = await getUserNotifyContext(recipientId);
  if (!ctx) return;

  const online = await isUserOnline(recipientId);
  const subs = await listPushSubscriptions(recipientId);
  const emailDebounced = kind === 'CHAT_MESSAGE' && conversationId
    ? await chatEmailDebounced(recipientId, conversationId)
    : false;

  const decision = decideExternalDelivery({
    notifyEmail: ctx.notifyEmail,
    notifyPush: ctx.notifyPush,
    recipientOnline: online,
    emailDebounced,
    hasEmail: !!ctx.email,
    pushSubscriptionCount: subs.length,
  });

  if (!decision.email && !decision.push) return;

  const actorName = await getUserDisplayName(actorId);

  if (decision.email && ctx.email) {
    const token = SIGNING_SECRET ? signNotifyUnsub(SIGNING_SECRET, recipientId) : null;
    const unsubscribeUrl = token ? `${APP_URL}/api/v1/notifications/unsubscribe?uid=${recipientId}&token=${token}` : null;
    const tpl = kind === 'FRIEND_REQUEST'
      ? friendRequestEmail({ actorName, appUrl: APP_URL, unsubscribeUrl })
      : chatMessageEmail({ actorName, appUrl: APP_URL, unsubscribeUrl });
    await sendBrevoEmail({ email: ctx.email, name: ctx.name }, tpl.subject, tpl.html);
  }

  if (decision.push) {
    const who = actorName ?? 'Кто-то';
    const payload = kind === 'FRIEND_REQUEST'
      ? { title: 'Заявка в друзья', body: `${who} хочет добавить вас в друзья`, url: `${APP_URL}/friends`, tag: 'friend-request' }
      : { title: 'Новое сообщение', body: `Новое сообщение от ${who}`, url: `${APP_URL}/messages`, tag: conversationId ?? 'chat' };
    const dead = await sendPush(subs, payload);
    if (dead.length) await deletePushSubscriptionsByEndpoints(dead);
  }
}

export function createNotifyExternalWorker() {
  return new Worker<ExternalNotifyJobData>(QUEUE_NOTIFY_EXTERNAL, handle, { connection, concurrency: 4 });
}
