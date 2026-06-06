'use client';

import { useState, useTransition } from 'react';
import { formatCount } from '@/lib/format';

interface Props {
  slug: string;
  initialFollowing: boolean;
  initialCount: number;
}

export function FollowButton({ slug, initialFollowing, initialCount }: Props) {
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !following;
    setFollowing(next);
    setCount((c) => c + (next ? 1 : -1));

    startTransition(async () => {
      const res = await fetch(`/api/v1/artists/${slug}/follow`, {
        method: next ? 'POST' : 'DELETE',
      });
      if (!res.ok) {
        // rollback on error
        setFollowing(!next);
        setCount((c) => c + (next ? -1 : 1));
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={toggle}
        disabled={pending}
        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all disabled:opacity-50 ${
          following
            ? 'bg-white/10 hover:bg-white/15 border border-white/20'
            : 'bg-[var(--artist-accent)] text-black hover:opacity-80'
        }`}
        style={following ? undefined : { color: 'var(--artist-bg, #0d0d0d)' }}
      >
        {following ? 'Подписан' : 'Подписаться'}
      </button>
      {count > 0 && (
        <span className="text-xs opacity-40 tabular-nums">
          {formatCount(count)}
        </span>
      )}
    </div>
  );
}
