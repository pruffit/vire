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
      title="Отписаться"
      aria-label="Отписаться"
      className="shrink-0 grid place-items-center w-7 h-7 rounded-full text-muted-foreground opacity-40 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all disabled:opacity-40 active:scale-90"
    >
      {isPending ? (
        <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      )}
    </button>
  );
}
