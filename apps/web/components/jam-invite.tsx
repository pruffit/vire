'use client';

import { useCallback, useState } from 'react';
import Image from 'next/image';
import { Icon } from '@/components/icon';
import { touchTargetClass } from '@/components/popover';
import { AdaptivePopover } from '@/components/adaptive-popover';
import { toast } from '@/lib/toast';

interface Friend {
  id: string;
  name: string | null;
  image: string | null;
}

interface Props {
  code: string;
}

export function JamInvite({ code }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [invitingId, setInvitingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/friends');
      const data = res.ok ? ((await res.json()) as { friends: Friend[] }) : { friends: [] };
      setFriends(data.friends);
    } catch {
      setFriends([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && friends === null) void load();
  }

  async function handleInvite(userId: string) {
    setInvitingId(userId);
    try {
      const res = await fetch(`/api/v1/jam/${encodeURIComponent(code)}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error();
      setInvited((s) => new Set(s).add(userId));
    } catch {
      toast.error('Не удалось пригласить');
    } finally {
      setInvitingId(null);
    }
  }

  return (
    <AdaptivePopover
      open={open}
      onOpenChange={handleOpenChange}
      align="left"
      drop="down"
      title="Пригласить друзей"
      panelClassName="w-64"
      trigger={({ toggle, ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggle}
          aria-label="Пригласить друзей"
          aria-expanded={open}
          className={`${touchTargetClass('md')} inline-flex items-center gap-1.5 rounded-full border border-border px-3 text-sm text-muted-foreground hover:text-foreground transition-colors`}
        >
          <Icon name="user-plus" size={14} />
        </button>
      )}
    >
      <div className="max-h-72 w-full overflow-y-auto py-1">
        {loading ? (
          <p className="px-3 py-4 text-center text-sm text-muted-foreground">Загрузка…</p>
        ) : !friends || friends.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-muted-foreground">Нет друзей</p>
        ) : (
          friends.map((f) => {
            const isInvited = invited.has(f.id);
            return (
              <div key={f.id} className="flex items-center gap-2.5 px-3 py-2">
                {f.image ? (
                  <Image src={f.image} alt="" width={28} height={28} className="h-7 w-7 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-medium text-muted-foreground">
                    {(f.name ?? '?')[0]?.toUpperCase()}
                  </span>
                )}
                <span className="flex-1 min-w-0 truncate text-sm text-foreground/85">{f.name ?? 'Слушатель'}</span>
                <button
                  type="button"
                  onClick={() => void handleInvite(f.id)}
                  disabled={isInvited || invitingId === f.id}
                  className="shrink-0 text-xs font-medium text-primary hover:text-foreground disabled:text-muted-foreground disabled:pointer-events-none transition-colors"
                >
                  {isInvited ? 'Приглашён' : invitingId === f.id ? '…' : 'Пригласить'}
                </button>
              </div>
            );
          })
        )}
      </div>
    </AdaptivePopover>
  );
}
