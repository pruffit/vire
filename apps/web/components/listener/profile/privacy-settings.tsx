'use client';

import { useState } from 'react';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

type Visibility = 'FRIENDS' | 'PRIVATE';

export function PrivacySettings({ initial }: { initial: Visibility }) {
  const [visibility, setVisibility] = useState<Visibility>(initial);
  const [pending, setPending] = useState(false);
  const isFriends = visibility === 'FRIENDS';

  async function toggle() {
    const prev = visibility;
    const next: Visibility = isFriends ? 'PRIVATE' : 'FRIENDS';
    setVisibility(next);
    setPending(true);
    try {
      const res = await fetch('/api/v1/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ socialVisibility: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      setVisibility(prev);
      toast.error('Не удалось сохранить настройку приватности');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card/60 px-4 py-3.5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">Лайки видны друзьям</p>
          <p className="text-xs text-muted-foreground">
            {isFriends ? 'Друзья видят твои лайки.' : 'Лайки скрыты от всех.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isFriends}
          aria-label="Лайки видны друзьям"
          disabled={pending}
          onClick={toggle}
          className="shrink-0 grid place-items-center min-h-11 min-w-11 cursor-pointer disabled:opacity-50"
        >
          <span
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full ring-1 ring-inset transition-colors',
              isFriends ? 'bg-primary ring-primary' : 'bg-foreground/15 ring-border',
            )}
          >
            <span
              className={cn(
                'absolute left-0.5 inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
                isFriends && 'translate-x-5',
              )}
            />
          </span>
        </button>
      </div>
    </div>
  );
}
