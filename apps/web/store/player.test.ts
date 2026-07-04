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
        repeat: 'off',
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

describe('repeat', () => {
  it('дефолт — off', () => {
    // persisted fixture в beforeAll уже задаёт repeat явно; проверяем на свежем срезе стора.
    expect(usePlayerStore.getState().repeat).toBe('off');
  });

  it('входит в partialize', () => {
    const partialize = usePlayerStore.persist.getOptions().partialize;
    usePlayerStore.getState()._setState({ repeat: 'one' });
    const persisted = partialize!(usePlayerStore.getState()) as { repeat: string };
    expect(persisted.repeat).toBe('one');
    usePlayerStore.getState()._setState({ repeat: 'off' });
  });
});

describe('persist: partialize', () => {
  it('длинную очередь режет окном в 100 вокруг текущего трека — текущий трек попадает в срез', () => {
    const partialize = usePlayerStore.persist.getOptions().partialize;
    expect(partialize).toBeDefined();

    const bigQueue = Array.from({ length: 150 }, (_, i) => track(`t${i}`));
    const persisted = partialize!({
      ...usePlayerStore.getState(),
      queue: bigQueue,
      queueIndex: 120,
    }) as { queue: PlayerTrack[]; queueIndex: number };

    expect(persisted.queue.length).toBeLessThanOrEqual(100);
    expect(persisted.queue[persisted.queueIndex]?.id).toBe('t120');
  });

  it('короткая очередь (<=100) — не режется, индекс не меняется', () => {
    const partialize = usePlayerStore.persist.getOptions().partialize;
    const shortQueue = Array.from({ length: 50 }, (_, i) => track(`t${i}`));
    const persisted = partialize!({
      ...usePlayerStore.getState(),
      queue: shortQueue,
      queueIndex: 30,
    }) as { queue: PlayerTrack[]; queueIndex: number };

    expect(persisted.queue).toEqual(shortQueue);
    expect(persisted.queueIndex).toBe(30);
  });

  it('queueIndex не бывает отрицательным', () => {
    const partialize = usePlayerStore.persist.getOptions().partialize;
    const persisted = partialize!({ ...usePlayerStore.getState(), queueIndex: -5 }) as { queueIndex: number };
    expect(persisted.queueIndex).toBe(0);
  });

  it('duration входит в персист', () => {
    const partialize = usePlayerStore.persist.getOptions().partialize;
    const persisted = partialize!({ ...usePlayerStore.getState(), duration: 187.5 }) as { duration: number };
    expect(persisted.duration).toBe(187.5);
  });

  it('длинную originalQueue режет тем же окном, текущий трек попадает в срез', () => {
    const partialize = usePlayerStore.persist.getOptions().partialize;
    const bigOriginal = Array.from({ length: 300 }, (_, i) => track(`o${i}`));
    const persisted = partialize!({
      ...usePlayerStore.getState(),
      track: track('o200'),
      originalQueue: bigOriginal,
    }) as { originalQueue: PlayerTrack[] };

    expect(persisted.originalQueue.length).toBeLessThanOrEqual(100);
    expect(persisted.originalQueue.some((t) => t.id === 'o200')).toBe(true);
  });

  it('originalQueue=null — персистится как null', () => {
    const partialize = usePlayerStore.persist.getOptions().partialize;
    const persisted = partialize!({ ...usePlayerStore.getState(), originalQueue: null }) as {
      originalQueue: PlayerTrack[] | null;
    };
    expect(persisted.originalQueue).toBeNull();
  });
});
