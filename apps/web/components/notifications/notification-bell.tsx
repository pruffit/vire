'use client';

import { useCallback, useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { Icon } from '@/components/icon';
import { AdaptivePopover } from '@/components/adaptive-popover';
import { useRealtime } from '@/lib/use-realtime';

type NotificationType = 'FRIEND_REQUEST' | 'FRIEND_ACCEPT' | 'JAM_INVITE' | 'PLAYLIST_COLLAB_JOIN';
type NotificationItem = {
  id: string;
  type: NotificationType;
  actorId: string | null;
  actorName: string | null;
  actorImage: string | null;
  entityId: string | null;
  createdAt: string;
  readAt: string | null;
};

const LABEL: Record<NotificationType, string> = {
  FRIEND_REQUEST: 'Заявка в друзья',
  FRIEND_ACCEPT: 'Теперь у вас в друзьях',
  JAM_INVITE: 'Зовёт в джем',
  PLAYLIST_COLLAB_JOIN: 'Присоединился к плейлисту',
};

function notificationHref(n: NotificationItem): string {
  if (n.type === 'JAM_INVITE') return n.entityId ? `/jam/id/${n.entityId}` : '/';
  if (n.type === 'PLAYLIST_COLLAB_JOIN') return n.entityId ? `/playlists/${n.entityId}` : '/library';
  return n.actorId ? `/u/${n.actorId}` : '/friends';
}

export function NotificationBell({ initialUnread = 0 }: { initialUnread?: number }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<NotificationItem[]>([]);

  const load = useCallback(async (): Promise<number> => {
    try {
      const res = await fetch('/api/v1/notifications');
      if (!res.ok) return 0;
      const data: { notifications: NotificationItem[]; unread: number } = await res.json();
      setItems(data.notifications);
      setUnread(data.unread);
      return data.unread;
    } catch {
      return 0;
    }
  }, []);

  useEffect(() => {
    // начальная подгрузка уведомлений с сервера (внешние данные, не производное состояние)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useRealtime({ notification: () => setUnread((u) => u + 1) });

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      const freshUnread = await load();
      if (freshUnread > 0) {
        setUnread(0);
        fetch('/api/v1/notifications/read', { method: 'POST' }).catch(() => {});
      }
    }
  }

  return (
    <AdaptivePopover
      open={open}
      onOpenChange={handleOpenChange}
      align="right"
      drop="down"
      title="Уведомления"
      panelClassName="w-80 max-w-[calc(100vw-1.5rem)]"
      trigger={({ toggle, ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggle}
          aria-label={unread > 0 ? `Уведомления, непрочитанных: ${unread}` : 'Уведомления'}
          className="relative grid h-10 w-10 place-items-center rounded-full text-foreground/70 transition-colors hover:bg-accent/10 hover:text-foreground"
        >
          <Icon name="bell" size={19} />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      )}
    >
      <div className="max-h-[70vh] overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">Нет уведомлений</p>
        ) : (
          items.map((n) => (
            <Link
              key={n.id}
              href={notificationHref(n)}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-foreground/8"
            >
              {n.actorImage ? (
                <Image src={n.actorImage} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-medium text-muted-foreground">
                  {(n.actorName ?? '?')[0]?.toUpperCase()}
                </span>
              )}
              <span className="min-w-0 flex-1 text-sm">
                <span className="font-medium">{n.actorName ?? 'Слушатель'}</span>
                <span className="block truncate text-xs text-muted-foreground">{LABEL[n.type]}</span>
              </span>
              {!n.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />}
            </Link>
          ))
        )}
      </div>
    </AdaptivePopover>
  );
}
