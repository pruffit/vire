'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Icon } from '@/components/icon';
import { toast } from '@/lib/toast';

const CLASS =
  'inline-flex items-center gap-1.5 rounded-full px-4 min-h-11 text-sm font-medium bg-secondary/60 text-foreground/80 transition-colors hover:bg-secondary disabled:opacity-50 disabled:pointer-events-none';

export function MessageFriendButton({ targetUserId }: { targetUserId: string }) {
  const t = useTranslations('chat.messageFriendButton');
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function open() {
    setPending(true);
    try {
      const res = await fetch('/api/v1/chat/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetUserId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { conversationId: string } = await res.json();
      router.push(`/messages/${data.conversationId}`);
    } catch {
      setPending(false);
      toast.error(t('failed'));
    }
  }

  return (
    <button type="button" onClick={open} disabled={pending} className={CLASS}>
      <Icon name="message-square" size={15} />
      {t('label')}
    </button>
  );
}
