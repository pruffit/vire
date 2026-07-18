import Link from 'next/link';
import type { ConversationSummary } from '@vire/core';
import { EmptyState } from '@/components/ui-kit';
import { ChatAvatar } from './chat-avatar';
import { formatMessageTimestamp } from './chat-format';

export function ConversationList({ conversations }: { conversations: ConversationSummary[] }) {
  if (conversations.length === 0) {
    return <EmptyState title="Пока нет диалогов" hint="Напишите другу с его профиля" />;
  }

  return (
    <div className="flex flex-col">
      {conversations.map((c) => (
        <Link
          key={c.id}
          href={`/messages/${c.id}`}
          className="group flex items-center gap-3 rounded-md px-3 py-3 transition-colors hover:bg-accent/5"
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
              {c.lastMessageBody ?? 'Нет сообщений'}
            </p>
          </div>
          {c.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />}
        </Link>
      ))}
    </div>
  );
}
