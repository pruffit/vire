import { create } from 'zustand';
import { likeResponseSchema } from '@vire/api-contracts';
import { apiRequest } from './api-client';

interface LikesState {
  state: Record<string, boolean>;
  load: (trackId: string) => void;
  update: (trackId: string, liked: boolean) => void;
  toggle: (trackId: string) => void;
  /** Ставит лайк, никогда не снимает — двойной тап по обложке (защита от случайного анлайка).
   *  Незагруженное состояние сначала догружает, как toggleRemote. */
  like: (trackId: string) => void;
  /**
   * Лайк с шторки уведомления: трек может ни разу не показывался в UI, поэтому state ещё
   * не загружен и обычный toggle() был бы no-op — здесь состояние сначала догружается.
   */
  toggleRemote: (trackId: string) => void;
}

const _pending = new Set<string>();
// In-flight guard для записи: вне стора, чтобы читаться синхронно (повторный тап по
// тому же треку до ответа сети должен быть no-op, а не гонкой POST/DELETE) — тот же
// паттерн, что apps/web/store/likes.ts.
const _toggling = new Set<string>();

export const useLikesStore = create<LikesState>((set, get) => {
  function write(trackId: string, next: boolean, rollback: boolean) {
    if (_toggling.has(trackId)) return;
    _toggling.add(trackId);
    get().update(trackId, next);

    apiRequest(`/api/v1/tracks/${trackId}/like`, {
      method: next ? 'POST' : 'DELETE',
      schema: likeResponseSchema,
    })
      .then((result) => {
        if (!result.ok) {
          get().update(trackId, rollback);
          console.error('[likes] не удалось сохранить лайк', trackId, result.error);
        }
      })
      .finally(() => { _toggling.delete(trackId); });
  }

  /** Действует сразу при известном состоянии; иначе сначала догружает его — общий приём
   *  для like() и toggleRemote(), трек мог ни разу не показываться в UI. */
  function withLoadedState(trackId: string, action: () => void) {
    if (get().state[trackId] !== undefined) {
      action();
      return;
    }
    apiRequest(`/api/v1/tracks/${trackId}/like`, { schema: likeResponseSchema })
      .then((result) => {
        if (!result.ok) return;
        get().update(trackId, result.data.liked);
        action();
      })
      .catch(() => {});
  }

  return {
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
      const current = get().state[trackId];
      if (current === undefined) return;
      write(trackId, !current, current);
    },

    like(trackId) {
      withLoadedState(trackId, () => {
        const current = get().state[trackId] ?? false;
        if (current) return;
        write(trackId, true, current);
      });
    },

    toggleRemote(trackId) {
      withLoadedState(trackId, () => get().toggle(trackId));
    },
  };
});
