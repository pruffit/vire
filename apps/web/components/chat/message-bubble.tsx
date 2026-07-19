import { formatMessageTimestamp } from './chat-format';

export function MessageBubble({ text, createdAt, own, pending }: { text: string; createdAt: Date | string; own: boolean; pending?: boolean }) {
  return (
    <div className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] sm:max-w-[65%] rounded-2xl px-4 py-2.5 ${
          own ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
        } ${pending ? 'opacity-60' : ''}`}
      >
        <p className="whitespace-pre-wrap break-words text-sm">{text}</p>
        <p className={`mt-1 text-right font-mono text-[11px] ${own ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          {formatMessageTimestamp(new Date(createdAt))}
        </p>
      </div>
    </div>
  );
}
