import type { ChatMessage } from '@vire/core';
import { formatMessageTimestamp } from './chat-format';

export function MessageBubble({ message, own, pending }: { message: ChatMessage; own: boolean; pending?: boolean }) {
  return (
    <div className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] sm:max-w-[65%] rounded-2xl px-4 py-2.5 ${
          own ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
        } ${pending ? 'opacity-60' : ''}`}
      >
        <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
        <p className={`mt-1 text-right font-mono text-[11px] ${own ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          {formatMessageTimestamp(new Date(message.createdAt))}
        </p>
      </div>
    </div>
  );
}
