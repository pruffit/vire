import { create } from 'zustand';

interface LikesState {
  state: Record<string, boolean>;
  load: (trackId: string) => void;
  update: (trackId: string, liked: boolean) => void;
}

const _pending = new Set<string>();

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
}));
