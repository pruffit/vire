'use client';

import { useEffect, useMemo } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import type { ConversationSummary } from '@vire/core';
import { EmptyState } from '@/components/ui-kit';
import { useIdentity } from '@/lib/e2ee-client';
import { deriveCK, decryptMessage, fromB64 } from '@/lib/e2ee';
import { useRealtime } from '@/lib/use-realtime';
import { useConversations, refreshConversations, applyIncomingMessage } from '@/lib/chat-conversations';
import { cn } from '@/lib/utils';
import { ChatAvatar } from './chat-avatar';
import { formatMessageTimestamp } from './chat-format';

export function ConversationList({ conversations: initial, viewerId }: { conversations: ConversationSummary[]; viewerId: string }) {
  const t = useTranslations('chat.conversationList');
  const tc = useTranslations('common');
  const format = useFormatter();
  const conversations = useConversations(initial, viewerId);
  const identity = useIdentity(viewerId);
  const pathname = usePathname();
  const activeId = pathname?.startsWith('/messages/') ? pathname.slice('/messages/'.length) : null;

  useRealtime({
    message: (event) => {
      const conversationId = event.conversationId as string | undefined;
      const message = event.message as { senderId: string; body: string; nonce: string; createdAt: string } | undefined;
      if (!conversationId || !message) return;
      applyIncomingMessage({ conversationId, message, senderId: message.senderId, viewerId, activeId });
    },
    '@reconnect': () => refreshConversations(),
  });

  useEffect(() => {
    function onFocus() {
      refreshConversations();
    }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const previews = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of conversations) {
      if (!c.lastMessageBody) {
        map.set(c.id, t('noMessages'));
        continue;
      }
      if (identity.priv && identity.pub && c.otherIkPub && c.lastMessageNonce) {
        const ck = deriveCK(identity.priv, fromB64(c.otherIkPub), identity.pub);
        map.set(c.id, decryptMessage(c.lastMessageBody, c.lastMessageNonce, ck) ?? '🔒');
      } else {
        map.set(c.id, t('encrypted'));
      }
    }
    return map;
  }, [conversations, identity.priv, identity.pub, t]);

  if (conversations.length === 0) {
    return <EmptyState title={t('empty')} hint={t('emptyHint')} />;
  }

  return (
    <div className="flex flex-col divide-y divide-border/60 p-2">
      {conversations.map((c) => {
        const active = pathname === `/messages/${c.id}`;
        return (
          <Link
            key={c.id}
            href={`/messages/${c.id}`}
            className={cn(
              'group relative flex items-center gap-3 px-3 py-3 transition-colors hover:bg-accent/5',
              active && 'bg-foreground/[0.08] before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary',
            )}
          >
            <ChatAvatar name={c.otherUserName} image={c.otherUserImage} fallbackName={tc('listenerFallback')} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className={cn('truncate text-sm', c.unread ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                  {c.otherUserName ?? tc('listenerFallback')}
                </p>
                {c.lastMessageAt && (
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {formatMessageTimestamp(new Date(c.lastMessageAt), format)}
                  </span>
                )}
              </div>
              <p className={cn('truncate text-sm', c.unread ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                {previews.get(c.id) ?? t('encrypted')}
              </p>
            </div>
            {c.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />}
          </Link>
        );
      })}
    </div>
  );
}
