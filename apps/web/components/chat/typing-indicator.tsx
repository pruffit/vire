'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRealtime } from '@/lib/use-realtime';

const TYPING_TIMEOUT_MS = 4000;

export function TypingIndicator({ conversationId, otherUserId }: { conversationId: string; otherUserId: string }) {
  const t = useTranslations('chat');
  const [typing, setTyping] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  useRealtime({
    'chat:typing': (event) => {
      const eventConversationId = event.conversationId as string | undefined;
      const eventUserId = event.userId as string | undefined;
      if (eventConversationId !== conversationId || eventUserId !== otherUserId) return;
      setTyping(true);
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setTyping(false), TYPING_TIMEOUT_MS);
    },
    message: (event) => {
      const eventConversationId = event.conversationId as string | undefined;
      if (eventConversationId !== conversationId) return;
      clearTimeout(timeoutRef.current);
      setTyping(false);
    },
  });

  if (!typing) return null;
  return <span className="block truncate text-xs text-muted-foreground">{t('typing')}</span>;
}
