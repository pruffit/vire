'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useRealtime } from '@/lib/use-realtime';
import { toast } from '@/lib/toast';
import { refreshUnread } from '@/lib/chat-unread';

/** Глобальный мост чата: тост + рефетч бейджа непрочитанных для событий не в открытом диалоге + по фокусу вкладки. */
export function ChatEventsBridge({ viewerId }: { viewerId: string }) {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    window.addEventListener('focus', refreshUnread);
    return () => window.removeEventListener('focus', refreshUnread);
  }, []);

  useRealtime({
    message: (event) => {
      const message = event.message as { senderId?: string } | undefined;
      const senderId = message?.senderId;
      if (!senderId || senderId === viewerId) return;

      // Счётчик тянем всегда — сервер знает правду о прочитанном; тост душим только на открытом диалоге.
      refreshUnread();
      const conversationId = event.conversationId as string | undefined;
      if (pathnameRef.current === `/messages/${conversationId}`) return;

      const senderName = (event.senderName as string | null | undefined) ?? 'Пользователь';
      toast(`Сообщение от ${senderName}`);
    },
  });

  return null;
}
