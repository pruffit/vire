'use client';

import { useState, useTransition } from 'react';

interface Props {
  trackId: string;
  initialLiked: boolean;
  initialCount: number;
}

export function LikeButton({ trackId, initialLiked, initialCount }: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));

    startTransition(async () => {
      const res = await fetch(`/api/v1/tracks/${trackId}/like`, {
        method: next ? 'POST' : 'DELETE',
      });
      if (!res.ok) {
        setLiked(!next);
        setCount((c) => c + (next ? -1 : 1));
      }
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      aria-label={liked ? 'Убрать лайк' : 'Лайкнуть'}
      className="flex items-center gap-1.5 text-sm transition-opacity disabled:opacity-40"
      style={{ color: liked ? 'var(--artist-accent)' : undefined, opacity: liked ? 1 : 0.4 }}
    >
      <HeartIcon filled={liked} />
      {count > 0 && (
        <span className="font-mono tabular-nums text-xs">{count}</span>
      )}
    </button>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
