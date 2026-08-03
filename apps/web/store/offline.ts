import { create } from 'zustand';
import { downloadTrack, removeDownload, cachedSegmentKeys, planDownload, type DownloadMeta } from '@/lib/offline/download';
import { getAllTracks } from '@/lib/offline/db';
import { toast } from '@/lib/toast';

export type OfflineStatus = 'idle' | 'downloading' | 'partial' | 'done';

export interface OfflineEntry {
  status: OfflineStatus;
  done: number;
  total: number;
}

interface OfflineState {
  entries: Map<string, OfflineEntry>;
  hydrated: boolean;
  hydrate(): Promise<void>;
  download(meta: DownloadMeta): void;
  cancel(trackId: string): void;
  remove(trackId: string): void;
}

const IDLE: OfflineEntry = { status: 'idle', done: 0, total: 0 };

// In-flight guard: вне стора, чтобы читаться синхронно (повторный клик «скачать» по
// тому же треку до ответа сети должен быть no-op, как в store/likes.ts).
const _downloading = new Set<string>();
const _controllers = new Map<string, AbortController>();

export const useOfflineStore = create<OfflineState>((set, get) => {
  function setEntry(trackId: string, entry: OfflineEntry): void {
    set((s) => {
      const entries = new Map(s.entries);
      entries.set(trackId, entry);
      return { entries };
    });
  }

  return {
    entries: new Map(),
    hydrated: false,

    async hydrate() {
      if (get().hydrated) return;
      set({ hydrated: true });
      const tracks = await getAllTracks();
      // Обход кэша сегментов нужен только чтобы честно посчитать done для partial —
      // done-записи по определению полны, cachedSegmentKeys() не запрашиваем без нужды.
      const hasPartial = tracks.some((t) => t.status === 'partial');
      const cachedKeys = hasPartial ? await cachedSegmentKeys() : [];
      set((s) => {
        const entries = new Map(s.entries);
        for (const track of tracks) {
          // Активная загрузка не персистится в IndexedDB до завершения — не затираем её живой прогресс.
          if (entries.get(track.id)?.status === 'downloading') continue;
          const total = track.segmentUrls.length;
          const done = track.status === 'partial'
            ? total - planDownload(track.segmentUrls, cachedKeys).length
            : total;
          entries.set(track.id, { status: track.status, done, total });
        }
        return { entries };
      });
    },

    download(meta) {
      const trackId = meta.id;
      if (_downloading.has(trackId)) return;
      if (get().entries.get(trackId)?.status === 'done') return;

      _downloading.add(trackId);
      const controller = new AbortController();
      _controllers.set(trackId, controller);
      setEntry(trackId, { status: 'downloading', done: 0, total: 0 });

      downloadTrack(meta, {
        signal: controller.signal,
        onProgress: (done, total) => setEntry(trackId, { status: 'downloading', done, total }),
      })
        .then((track) => {
          const wasCancelled = controller.signal.aborted;
          const total = track.segmentUrls.length;
          // У недокачанного done — то, что реально успело лечь; иначе прогресс схлопнется в 100%.
          const progress = get().entries.get(trackId);
          setEntry(trackId, {
            status: track.status,
            done: track.status === 'partial' ? Math.min(progress?.done ?? 0, total) : total,
            total,
          });
          if (track.status === 'partial' && !wasCancelled) {
            toast.error('Не удалось скачать трек офлайн');
          }
        })
        .catch(() => {
          setEntry(trackId, IDLE);
          toast.error('Не удалось скачать трек офлайн');
        })
        .finally(() => {
          _downloading.delete(trackId);
          _controllers.delete(trackId);
        });
    },

    cancel(trackId) {
      _controllers.get(trackId)?.abort();
    },

    remove(trackId) {
      removeDownload(trackId)
        .then(() => setEntry(trackId, IDLE))
        .catch(() => toast.error('Не удалось удалить офлайн-копию'));
    },
  };
});
