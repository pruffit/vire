import { useState } from 'react';
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import type { ApiResult } from '@vire/api-client';
import type { FriendshipStatusDTO } from '@vire/api-contracts';
import { sendFriendRequest, removeFriendEdge, acceptFriendRequest } from './friends';

interface FriendActionState {
  status: FriendshipStatusDTO;
  pending: boolean;
  request: () => Promise<void>;
  remove: () => Promise<void>;
  accept: () => Promise<void>;
}

type FriendActionStore = UseBoundStore<StoreApi<FriendActionState>>;

/**
 * Порт состояния apps/web/components/friends/friend-button.tsx: оптимистичный переход +
 * откат на ошибке. Стор создаётся per-instance (один на кнопку), не глобальный —
 * тестируется напрямую (getState()), как lib/likes-store.ts, без рендера React.
 */
export function createFriendActionStore(userId: string, initialStatus: FriendshipStatusDTO): FriendActionStore {
  return create<FriendActionState>((set, get) => {
    async function mutate(next: FriendshipStatusDTO, run: () => Promise<ApiResult<unknown>>) {
      const prev = get().status;
      set({ status: next, pending: true });
      const result = await run();
      if (!result.ok) {
        set({ status: prev, pending: false });
        return;
      }
      set({ pending: false });
    }

    return {
      status: initialStatus,
      pending: false,
      request: () => mutate('OUTGOING', () => sendFriendRequest(userId)),
      // DELETE покрывает отмену исходящей, отклонение входящей и unfriend — семантика решается тем, какая кнопка была показана.
      remove: () => mutate('NONE', () => removeFriendEdge(userId)),
      accept: () => mutate('FRIENDS', () => acceptFriendRequest(userId)),
    };
  });
}

export function useFriendAction(userId: string, initialStatus: FriendshipStatusDTO): FriendActionState {
  const [useStore] = useState(() => createFriendActionStore(userId, initialStatus));
  return useStore();
}
