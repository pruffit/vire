import { getTranslator, localizedPath, type Locale } from '@vire/i18n';
import { friendRequestEmail, chatMessageEmail } from './email-templates';
import type { ExternalNotifyKind } from '../../jobs';

export interface ExternalEventContext {
  actorId: string;
  actorName: string | null;
  appUrl: string;
  locale: Locale;
  unsubscribeUrl: string | null;
  conversationId?: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export interface ExternalNotifyEventDef {
  email(ctx: ExternalEventContext): Promise<{ subject: string; html: string }>;
  push(ctx: ExternalEventContext): Promise<PushPayload>;
  /** Ключ, по которому письма события схлопываются: второе письмо в том же диалоге не шлётся. */
  debounce?: 'conversation';
}

async function actorLabel(locale: Locale, actorName: string | null): Promise<string> {
  const t = await getTranslator(locale, 'email');
  return actorName ?? t('someone');
}

export const EXTERNAL_NOTIFY_EVENTS: Record<ExternalNotifyKind, ExternalNotifyEventDef> = {
  FRIEND_REQUEST: {
    email: (ctx) => friendRequestEmail({
      actorName: ctx.actorName,
      appUrl: ctx.appUrl,
      unsubscribeUrl: ctx.unsubscribeUrl,
      locale: ctx.locale,
    }),
    async push(ctx) {
      const t = await getTranslator(ctx.locale, 'email');
      return {
        title: t('push.friendRequest.title'),
        body: t('push.friendRequest.body', { name: await actorLabel(ctx.locale, ctx.actorName) }),
        url: `${ctx.appUrl}${localizedPath(ctx.locale, '/friends')}`,
        tag: `friend-request:${ctx.actorId}`,
      };
    },
  },
  CHAT_MESSAGE: {
    email: (ctx) => chatMessageEmail({
      actorName: ctx.actorName,
      appUrl: ctx.appUrl,
      unsubscribeUrl: ctx.unsubscribeUrl,
      locale: ctx.locale,
    }),
    async push(ctx) {
      const t = await getTranslator(ctx.locale, 'email');
      return {
        title: t('push.chatMessage.title'),
        body: t('push.chatMessage.body', { name: await actorLabel(ctx.locale, ctx.actorName) }),
        url: `${ctx.appUrl}${localizedPath(ctx.locale, '/messages')}`,
        tag: ctx.conversationId ?? 'chat',
      };
    },
    debounce: 'conversation',
  },
};
