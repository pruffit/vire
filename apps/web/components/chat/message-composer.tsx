'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '@/components/icon';

const BODY_MAX = 4000;
const TYPING_THROTTLE_MS = 2500;

export function MessageComposer({
  conversationId,
  onSend,
  disabled,
}: {
  conversationId: string;
  onSend: (body: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastTypingSentRef = useRef(0);

  function submit() {
    const body = value.trim();
    if (!body || disabled) return;
    onSend(body);
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function notifyTyping() {
    const now = Date.now();
    if (now - lastTypingSentRef.current < TYPING_THROTTLE_MS) return;
    lastTypingSentRef.current = now;
    fetch(`/api/v1/chat/${conversationId}/typing`, { method: 'POST' }).catch(() => {});
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
    if (e.target.value.trim()) notifyTyping();
  }

  if (disabled) {
    return (
      <div className="sticky bottom-0 shrink-0 border-t border-border/40 bg-background px-4 py-3 text-center text-sm text-muted-foreground">
        Написать можно только другу
      </div>
    );
  }

  return (
    <div className="sticky bottom-0 flex shrink-0 items-end gap-2 border-t border-border/40 bg-background px-3 py-3 sm:px-4">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder="Сообщение"
        rows={1}
        maxLength={BODY_MAX}
        className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl border border-border/60 bg-background px-4 py-2.5 text-sm outline-none focus:border-ring"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!value.trim()}
        aria-label="Отправить"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
      >
        <Icon name="arrow-right" size={18} />
      </button>
    </div>
  );
}
