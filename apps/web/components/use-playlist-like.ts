'use client';

import { useState } from 'react';

export function usePlaylistLike(playlistId: string, initialLiked: boolean, initialCount: number) {
  const [liked, setLiked] = useState(initialLiked);
  const [likes, setLikes] = useState(initialCount);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    setPending(true);
    const willLike = !liked;
    setLiked(willLike);
    setLikes((n) => n + (willLike ? 1 : -1));
    try {
      await fetch(`/api/v1/playlists/${playlistId}/like`, {
        method: willLike ? 'POST' : 'DELETE',
      });
    } catch {
      // откат
      setLiked(!willLike);
      setLikes((n) => n + (willLike ? -1 : 1));
    } finally {
      setPending(false);
    }
  }

  return { liked, likes, pending, toggle };
}
