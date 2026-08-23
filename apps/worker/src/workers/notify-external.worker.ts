import { Worker, type Job } from 'bullmq';
import { QUEUE_NOTIFY_EXTERNAL, type ExternalNotifyJobData, decideExternalDelivery, EXTERNAL_NOTIFY_EVENTS } from '@vire/core';
import { signNotifyUnsub } from '@vire/core/notifications/unsubscribe'; // субпуть: node:crypto не в edge-safe корневом barrel (Task 15)
import { getUserNotifyContext, getUserDisplayName, listPushSubscriptions, deletePushSubscriptionsByEndpoints, listExpoPushTokens, deleteExpoPushTokensByTokens } from '@vire/db';
import { isLocale, DEFAULT_LOCALE, type Locale } from '@vire/i18n';
import { connection } from '../queues/connection.js';
import { sendBrevoEmail } from '../lib/brevo.js';
import { sendPush } from '../lib/webpush.js';
import { sendExpoPush } from '../lib/expo-push.js';
import { isUserOnline } from '../lib/user-presence.js';
import { chatEmailDebounced } from '../lib/notify-debounce.js';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const SIGNING_SECRET = process.env.LINK_SIGNING_SECRET || process.env.AUTH_SECRET || null;

export async function handle(job: Job<ExternalNotifyJobData>): Promise<void> {
  const { kind, recipientId, actorId, conversationId } = job.data;
  const event = EXTERNAL_NOTIFY_EVENTS[kind];
  if (!event) return;

  const ctx = await getUserNotifyContext(recipientId);
  if (!ctx) return;

  if (await isUserOnline(recipientId)) return;

  const [subs, expoTokens] = await Promise.all([
    listPushSubscriptions(recipientId),
    listExpoPushTokens(recipientId),
  ]);

  const decision = decideExternalDelivery({
    notifyEmail: ctx.notifyEmail,
    notifyPush: ctx.notifyPush,
    recipientOnline: false,
    emailDebounced: false,
    hasEmail: !!ctx.email,
    pushSubscriptionCount: subs.length + expoTokens.length,
  });

  // Дебаунс-ключ ставится только в момент реальной отправки письма, не раньше.
  let sendEmail = decision.email;
  if (decision.email && event.debounce === 'conversation' && conversationId) {
    const already = await chatEmailDebounced(recipientId, conversationId);
    if (already) sendEmail = false;
  }

  if (!sendEmail && !decision.push) return;

  const actorName = await getUserDisplayName(actorId);
  const locale: Locale = isLocale(ctx.locale ?? '') ? (ctx.locale as Locale) : DEFAULT_LOCALE;

  if (sendEmail && ctx.email) {
    const token = SIGNING_SECRET ? signNotifyUnsub(SIGNING_SECRET, recipientId) : null;
    const unsubscribeUrl = token
      ? `${APP_URL}/api/v1/notifications/unsubscribe?uid=${recipientId}&token=${token}&locale=${locale}`
      : null;
    const tpl = await event.email({ actorId, actorName, appUrl: APP_URL, unsubscribeUrl, locale, conversationId });
    const unsubHeaders = unsubscribeUrl
      ? { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
      : undefined;
    await sendBrevoEmail({ email: ctx.email, name: ctx.name }, tpl.subject, tpl.html, unsubHeaders);
  }

  if (decision.push) {
    const payload = await event.push({ actorId, actorName, appUrl: APP_URL, locale, unsubscribeUrl: null, conversationId });
    const [dead, deadExpo] = await Promise.all([
      sendPush(subs, payload),
      sendExpoPush(expoTokens.map((t) => t.token), payload),
    ]);
    if (dead.length) {
      try { await deletePushSubscriptionsByEndpoints(dead); } catch { /* пруна не должна валить джобу и триггерить ретрай письма */ }
    }
    if (deadExpo.length) {
      try { await deleteExpoPushTokensByTokens(deadExpo); } catch { /* пруна не должна валить джобу */ }
    }
  }
}

export function createNotifyExternalWorker() {
  return new Worker<ExternalNotifyJobData>(QUEUE_NOTIFY_EXTERNAL, handle, { connection, concurrency: 4 });
}
