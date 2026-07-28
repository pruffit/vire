'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icon';
import { toast } from '@/lib/toast';

export function PlaylistLeaveButton({ playlistId }: { playlistId: string }) {
  const [left, setLeft] = useState(false);
  const router = useRouter();

  async function leave() {
    setLeft(true);
    const res = await fetch(`/api/v1/playlists/${playlistId}/collaborators`, { method: 'DELETE' }).catch(() => null);
    if (!res?.ok) {
      setLeft(false);
      toast.error('Не удалось покинуть плейлист');
      return;
    }
    router.push('/library');
  }

  return (
    <button
      type="button"
      onClick={() => void leave()}
      disabled={left}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border px-3 text-xs text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
    >
      <Icon name="log-out" size={13} />
      {left ? 'Вы вышли' : 'Покинуть плейлист'}
    </button>
  );
}
