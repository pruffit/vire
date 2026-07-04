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
      const res = await fetch(`/api/v1/playlists/${playlistId}/like`, {
        method: willLike ? 'POST' : 'DELETE',
      });
      // fetch реджектится только на сетевом сбое — HTTP-ошибку (401/429/5xx)
      // ловим сами, иначе оптимистичный флип рассинхронит UI с БД.
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setLiked(!willLike);
      setLikes((n) => n + (willLike ? -1 : 1));
    } finally {
      setPending(false);
    }
  }

  return { liked, likes, pending, toggle };
}
