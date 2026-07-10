'use client';

import { likePlaylist } from '@vire/api-client';
import { useOptimisticToggle } from '@/lib/use-optimistic-toggle';

export function usePlaylistLike(playlistId: string, initialLiked: boolean, initialCount: number) {
  const {
    on: liked,
    count: likes,
    pending,
    toggle,
  } = useOptimisticToggle({
    id: playlistId,
    initial: initialLiked,
    initialCount,
    request: (next) => likePlaylist(playlistId, next),
    errorMessage: 'Не удалось сохранить лайк',
  });

  return { liked, likes, pending, toggle };
}
