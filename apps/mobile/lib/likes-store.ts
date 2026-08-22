import { create } from 'zustand';
import { likeResponseSchema } from '@vire/api-contracts';
import { apiRequest } from './api-client';

interface LikesState {
  state: Record<string, boolean>;
  load: (trackId: string) => void;
  update: (trackId: string, liked: boolean) => void;
  toggle: (trackId: string) => void;
}

const _pending = new Set<string>();
// In-flight guard для toggle: вне стора, чтобы читаться синхронно (повторный тап по
// тому же треку до ответа сети должен быть no-op, а не гонкой POST/DELETE) — тот же
// паттерн, что apps/web/store/likes.ts.
const _toggling = new Set<string>();

export const useLikesStore = create<LikesState>((set, get) => ({
  state: {},

  load(trackId) {
    if (trackId in get().state) return;
    if (_pending.has(trackId)) return;
    _pending.add(trackId);

    apiRequest(`/api/v1/tracks/${trackId}/like`, { schema: likeResponseSchema })
      .then((result) => {
        _pending.delete(trackId);
        if (result.ok) set((s) => ({ state: { ...s.state, [trackId]: result.data.liked } }));
      })
      .catch(() => { _pending.delete(trackId); });
  },

  update(trackId, liked) {
    set((s) => ({ state: { ...s.state, [trackId]: liked } }));
  },

  toggle(trackId) {
    if (_toggling.has(trackId)) return;
    const current = get().state[trackId];
    if (current === undefined) return;

    const next = !current;
    _toggling.add(trackId);
    get().update(trackId, next);

    apiRequest(`/api/v1/tracks/${trackId}/like`, {
      method: next ? 'POST' : 'DELETE',
      schema: likeResponseSchema,
    })
      .then((result) => {
        if (!result.ok) {
          get().update(trackId, current);
          console.error('[likes] не удалось сохранить лайк', trackId, result.error);
        }
      })
      .finally(() => { _toggling.delete(trackId); });
  },
}));
