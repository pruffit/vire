'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  artistSlug: string;
}

export function UnfollowButton({ artistSlug }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleUnfollow(e: React.MouseEvent) {
    e.preventDefault();
    startTransition(async () => {
      await fetch(`/api/v1/artists/${artistSlug}/follow`, { method: 'DELETE' });
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleUnfollow}
      disabled={isPending}
      className="shrink-0 text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
      aria-label="Отписаться"
    >
      {isPending ? '...' : 'Отписаться'}
    </button>
  );
}
