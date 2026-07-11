import { create } from 'zustand';
import { likeTrack } from '@vire/api-client';
import { toast } from '@/components/toast';

interface LikesState {
  state: Record<string, boolean>;
  load: (trackId: string) => void;
  update: (trackId: string, liked: boolean) => void;
  toggle: (trackId: string) => void;
}

const _pending = new Set<string>();
// In-flight guard для toggle: вне стора, чтобы читаться синхронно (ре-клик по
// тому же треку до ответа сети должен быть no-op, а не гонкой POST/DELETE).
const _toggling = new Set<string>();

export const useLikesStore = create<LikesState>((set, get) => ({
  state: {},

  load(trackId) {
    if (trackId in get().state) return;
    if (_pending.has(trackId)) return;
    _pending.add(trackId);
    fetch(`/api/v1/tracks/${trackId}/like`)
      .then((r) => (r.ok ? (r.json() as Promise<{ liked: boolean }>) : null))
      .then((d) => {
        _pending.delete(trackId);
        if (d !== null) set((s) => ({ state: { ...s.state, [trackId]: d.liked } }));
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

    likeTrack(trackId, next)
      .then((res) => {
        if (!res.ok) {
          get().update(trackId, current);
          toast.error('Не удалось сохранить лайк');
        }
      })
      .finally(() => { _toggling.delete(trackId); });
  },
}));
