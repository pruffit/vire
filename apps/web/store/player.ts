import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { PlaySource } from '@vire/api-contracts';

export interface PlayerTrack {
  id: string;
  title: string;
  artistName: string;
  coverUrl: string | null;
  // Опциональны: нужны плееру для переходов на страницы артиста и релиза.
  // Если источник не знает их (например, дашборд) — ссылки просто не рендерятся.
  artistSlug?: string;
  releaseId?: string;
  // Акцент-цвет артиста — инжектируется в плеер как --artist-accent.
  accentColor?: string;
  // Возрастная маркировка 18+ (explicit) — плеер показывает бейдж.
  isExplicit?: boolean;
}

/** Откуда запущено воспроизведение — для аналитики и «вернуться к источнику». */
export interface PlayContext {
  source: PlaySource;
  sourceId?: string;
}

interface State {
  track: PlayerTrack | null;
  queue: PlayerTrack[];
  queueIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  hasAudio: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  waveformPeaks: number[] | null;
  /** Режим волны — автоплей похожих треков когда очередь исчерпана */
  waveMode: boolean;
  /** Случайный порядок внутри очереди */
  shuffle: boolean;
  /** Ошибка загрузки HLS-манифеста или сети */
  audioError: boolean;
  /** Источник текущего воспроизведения (релиз/плейлист/волна/...) */
  context: PlayContext | null;
  /** Очередь до шаффла — хранится, только пока shuffle=true, чтобы честно выключить его назад */
  originalQueue: PlayerTrack[] | null;
  /** true сразу после гидрации persist, если в хранилище был трек (плеер стоит на паузе, манифест ещё не грузился) */
  restored: boolean;
}

interface Store extends State {
  _setState(patch: Partial<State>): void;
}

const PERSISTED_QUEUE_LIMIT = 100;

type PersistedState = Pick<
  State,
  'track' | 'queue' | 'queueIndex' | 'volume' | 'waveMode' | 'shuffle' | 'context' | 'originalQueue' | 'currentTime'
>;

export const usePlayerStore = create<Store>()(
  persist(
    (set) => ({
      track: null,
      queue: [],
      queueIndex: 0,
      isPlaying: false,
      isLoading: false,
      hasAudio: false,
      currentTime: 0,
      duration: 0,
      volume: 0.8,
      waveformPeaks: null,
      waveMode: false,
      shuffle: false,
      audioError: false,
      context: null,
      originalQueue: null,
      restored: false,
      _setState: (patch) => set(patch),
    }),
    {
      name: 'vire-player',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedState => ({
        track: state.track,
        queue: state.queue.slice(0, PERSISTED_QUEUE_LIMIT),
        queueIndex: state.queueIndex,
        volume: state.volume,
        waveMode: state.waveMode,
        shuffle: state.shuffle,
        context: state.context,
        originalQueue: state.originalQueue,
        currentTime: state.currentTime,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.track) {
          state.restored = true;
          state.isPlaying = false;
          state.hasAudio = false;
          state.isLoading = false;
        }
      },
    },
  ),
);
