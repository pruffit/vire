import { create } from 'zustand';
import { likeResponseSchema, type LikeResponse } from '@vire/api-contracts';
import type { ApiResult } from '@vire/api-client';
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

// In-flight GET по треку: вне стора, чтобы читаться синхронно и делиться между load() и
// withLoadedState() — двойной тап по незагруженному треку не должен слать второй такой же GET.
const _pending = new Map<string, Promise<ApiResult<LikeResponse>>>();
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

  /** GET состояния лайка, разделяемый всеми вызовами на один и тот же трек — присоединяется
   *  к уже летящему запросу вместо повторного. */
  function fetchState(trackId: string): Promise<ApiResult<LikeResponse>> {
    const inFlight = _pending.get(trackId);
    if (inFlight) return inFlight;

    const request = apiRequest(`/api/v1/tracks/${trackId}/like`, { schema: likeResponseSchema })
      .then((result) => {
        if (result.ok) get().update(trackId, result.data.liked);
        return result;
      })
      .finally(() => { _pending.delete(trackId); });

    _pending.set(trackId, request);
    return request;
  }

  /** Действует сразу при известном состоянии; иначе сначала догружает его — общий приём
   *  для like() и toggleRemote(), трек мог ни разу не показываться в UI. */
  function withLoadedState(trackId: string, action: () => void) {
    if (get().state[trackId] !== undefined) {
      action();
      return;
    }
    fetchState(trackId)
      .then((result) => {
        if (result.ok) action();
      })
      .catch(() => {});
  }

  return {
    state: {},

    load(trackId) {
      if (trackId in get().state) return;
      fetchState(trackId).catch(() => {});
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
