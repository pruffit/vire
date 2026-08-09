'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { FriendshipStatus } from '@vire/core';
import { Icon } from '@/components/icon';
import { toast } from '@/lib/toast';

interface Props {
  targetUserId: string;
  initialStatus: FriendshipStatus;
}

const BASE =
  'inline-flex items-center gap-1.5 rounded-full px-4 min-h-11 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none';
const PRIMARY = `${BASE} bg-primary text-primary-foreground hover:opacity-90`;
const MUTED = `${BASE} bg-secondary/60 text-foreground/70 hover:bg-secondary`;

export function FriendButton({ targetUserId, initialStatus }: Props) {
  const t = useTranslations('social.friendButton');
  const [status, setStatus] = useState<FriendshipStatus>(initialStatus);
  const [pending, setPending] = useState(false);

  if (status === 'SELF') return null;

  async function mutate(next: FriendshipStatus, run: () => Promise<Response>, errorText: string) {
    const prev = status;
    setStatus(next);
    setPending(true);
    try {
      const res = await run();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      setStatus(prev);
      toast.error(errorText);
    } finally {
      setPending(false);
    }
  }

  const request = () =>
    mutate(
      'OUTGOING',
      () =>
        fetch('/api/v1/friends/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: targetUserId }),
        }),
      t('errors.request'),
    );

  // DELETE /friends/[userId] отменяет исходящую, отклоняет входящую и удаляет из друзей — одно действие
  const remove = () =>
    mutate('NONE', () => fetch(`/api/v1/friends/${targetUserId}`, { method: 'DELETE' }), t('errors.action'));

  const accept = () =>
    mutate('FRIENDS', () => fetch(`/api/v1/friends/${targetUserId}/accept`, { method: 'POST' }), t('errors.accept'));

  if (status === 'NONE') {
    return (
      <button type="button" onClick={request} disabled={pending} className={PRIMARY}>
        <Icon name="user-plus" size={15} />
        {t('add')}
      </button>
    );
  }

  if (status === 'OUTGOING') {
    return (
      <button type="button" onClick={remove} disabled={pending} className={MUTED}>
        <Icon name="x" size={15} />
        {t('requestSent')}
      </button>
    );
  }

  if (status === 'INCOMING') {
    return (
      <div className="flex items-center gap-2">
        <button type="button" onClick={accept} disabled={pending} className={PRIMARY}>
          <Icon name="check" size={15} />
          {t('accept')}
        </button>
        <button type="button" onClick={remove} disabled={pending} className={MUTED}>
          {t('decline')}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      aria-label={t('removeAria')}
      className={`group ${MUTED} hover:bg-destructive/15 hover:text-destructive`}
    >
      <span className="inline-flex items-center gap-1.5 group-hover:hidden">
        <Icon name="user-check" size={15} />
        {t('friends')}
      </span>
      <span className="hidden items-center gap-1.5 group-hover:inline-flex">
        <Icon name="user-x" size={15} />
        {t('remove')}
      </span>
    </button>
  );
}
