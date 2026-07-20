'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ConversationSummary } from '@vire/core';
import { EmptyState } from '@/components/ui-kit';
import { useIdentity } from '@/lib/e2ee-client';
import { deriveCK, decryptMessage, fromB64 } from '@/lib/e2ee';
import { cn } from '@/lib/utils';
import { ChatAvatar } from './chat-avatar';
import { formatMessageTimestamp } from './chat-format';

export function ConversationList({ conversations, viewerId }: { conversations: ConversationSummary[]; viewerId: string }) {
  const identity = useIdentity(viewerId);
  const pathname = usePathname();

  const previews = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of conversations) {
      if (!c.lastMessageBody) {
        map.set(c.id, 'Нет сообщений');
        continue;
      }
      if (identity.priv && identity.pub && c.otherIkPub && c.lastMessageNonce) {
        const ck = deriveCK(identity.priv, fromB64(c.otherIkPub), identity.pub);
        map.set(c.id, decryptMessage(c.lastMessageBody, c.lastMessageNonce, ck) ?? '🔒');
      } else {
        map.set(c.id, '🔒 Зашифровано');
      }
    }
    return map;
  }, [conversations, identity.priv, identity.pub]);

  if (conversations.length === 0) {
    return <EmptyState title="Пока нет диалогов" hint="Напишите другу с его профиля" />;
  }

  return (
    <div className="flex flex-col p-2">
      {conversations.map((c) => {
        const active = pathname === `/messages/${c.id}`;
        return (
          <Link
            key={c.id}
            href={`/messages/${c.id}`}
            className={cn(
              'group flex items-center gap-3 rounded-md px-3 py-3 transition-colors hover:bg-accent/5',
              active && 'bg-accent/10',
            )}
          >
            <ChatAvatar name={c.otherUserName} image={c.otherUserImage} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className={`truncate text-sm ${c.unread ? 'font-semibold' : 'font-medium'}`}>
                  {c.otherUserName ?? 'Слушатель'}
                </p>
                {c.lastMessageAt && (
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {formatMessageTimestamp(new Date(c.lastMessageAt))}
                  </span>
                )}
              </div>
              <p className={`truncate text-sm ${c.unread ? 'text-foreground' : 'text-muted-foreground'}`}>
                {previews.get(c.id) ?? '🔒 Зашифровано'}
              </p>
            </div>
            {c.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />}
          </Link>
        );
      })}
    </div>
  );
}
