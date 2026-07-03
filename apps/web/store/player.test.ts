import { describe, it, expect, vi, beforeAll } from 'vitest';
import type { PlayerTrack } from './player';

let usePlayerStore: typeof import('./player').usePlayerStore;

function track(id: string): PlayerTrack {
  return { id, title: `title-${id}`, artistName: 'artist', coverUrl: null };
}

const memory = new Map<string, string>();

beforeAll(async () => {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  });

  memory.set(
    'vire-player',
    JSON.stringify({
      state: {
        track: track('persisted'),
        queue: [track('persisted')],
        queueIndex: 0,
        volume: 0.5,
        waveMode: false,
        shuffle: false,
        context: null,
        originalQueue: null,
        currentTime: 42,
      },
      version: 1,
    }),
  );

  ({ usePlayerStore } = await import('./player'));
});

describe('persist: регидрация', () => {
  it('восстанавливает трек и позицию, выставляет restored, глушит isPlaying/hasAudio/isLoading', () => {
    const s = usePlayerStore.getState();
    expect(s.track?.id).toBe('persisted');
    expect(s.currentTime).toBe(42);
    expect(s.restored).toBe(true);
    expect(s.isPlaying).toBe(false);
    expect(s.hasAudio).toBe(false);
    expect(s.isLoading).toBe(false);
  });

  it('restored реактивен: подписчик получает restored=true в момент регидрации', async () => {
    usePlayerStore.getState()._setState({ restored: false, isPlaying: true });

    const seenRestored: boolean[] = [];
    const unsub = usePlayerStore.subscribe((s) => seenRestored.push(s.restored));

    await usePlayerStore.persist.rehydrate();
    unsub();

    expect(seenRestored).toContain(true);
    expect(usePlayerStore.getState().restored).toBe(true);
    expect(usePlayerStore.getState().isPlaying).toBe(false);
  });
});

describe('persist: partialize', () => {
  it('режет queue до 100 и клампит queueIndex в границы среза', () => {
    const partialize = usePlayerStore.persist.getOptions().partialize;
    expect(partialize).toBeDefined();

    const bigQueue = Array.from({ length: 150 }, (_, i) => track(`t${i}`));
    const persisted = partialize!({
      ...usePlayerStore.getState(),
      queue: bigQueue,
      queueIndex: 120,
    }) as { queue: PlayerTrack[]; queueIndex: number };

    expect(persisted.queue).toHaveLength(100);
    expect(persisted.queueIndex).toBe(99);
  });

  it('queueIndex не бывает отрицательным', () => {
    const partialize = usePlayerStore.persist.getOptions().partialize;
    const persisted = partialize!({ ...usePlayerStore.getState(), queueIndex: -5 }) as { queueIndex: number };
    expect(persisted.queueIndex).toBe(0);
  });
});
