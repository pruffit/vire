import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { PlaySource } from '@vire/api-contracts';
import { sliceWindowAroundIndex, type Repeat } from '@/lib/player/queue';

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
  /** Seed, с которым запущена текущая волна (для подсветки активного чипа) — сессионный, не persist */
  waveSeed: { mood?: string; genre?: string } | null;
  /** Случайный порядок внутри очереди */
  shuffle: boolean;
  /** Повтор: off — обычная очередь, all — очередь зацикливается, one — зацикливается трек */
  repeat: Repeat;
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
// Сколько уже проигранных треков перед текущим сохраняем в окне — так prev()
// после F5 ещё работает на несколько шагов назад, а не только вперёд.
const PERSISTED_QUEUE_WINDOW_BEFORE = 20;

type PersistedState = Pick<
  State,
  | 'track'
  | 'queue'
  | 'queueIndex'
  | 'volume'
  | 'waveMode'
  | 'shuffle'
  | 'repeat'
  | 'context'
  | 'originalQueue'
  | 'currentTime'
  | 'duration'
>;

/** Длинную очередь (волна) режем окном вокруг текущего трека — иначе
 *  slice(0,100) на queueIndex>99 персистит хвост без текущего трека, и после
 *  restore clampRestoredQueueIndex не находит его (queueIndex улетает на 0). */
function sliceQueueForPersist(
  queue: PlayerTrack[],
  queueIndex: number,
): { queue: PlayerTrack[]; queueIndex: number } {
  const { items, index } = sliceWindowAroundIndex(
    queue,
    queueIndex,
    PERSISTED_QUEUE_LIMIT,
    PERSISTED_QUEUE_WINDOW_BEFORE,
  );
  return { queue: items, queueIndex: index };
}

/** originalQueue (шаффл) режем тем же окном, но по позиции текущего трека В НЕЙ —
 *  queueIndex указывает на позицию в `queue` (перемешанной), не в originalQueue. */
function sliceOriginalQueueForPersist(
  originalQueue: PlayerTrack[] | null,
  currentTrackId: string | undefined,
): PlayerTrack[] | null {
  if (!originalQueue) return null;
  const index = currentTrackId ? originalQueue.findIndex((t) => t.id === currentTrackId) : -1;
  return sliceWindowAroundIndex(
    originalQueue,
    index >= 0 ? index : 0,
    PERSISTED_QUEUE_LIMIT,
    PERSISTED_QUEUE_WINDOW_BEFORE,
  ).items;
}

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
      waveSeed: null,
      shuffle: false,
      repeat: 'off',
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
      partialize: (state): PersistedState => {
        const { queue, queueIndex } = sliceQueueForPersist(state.queue, state.queueIndex);
        return {
          track: state.track,
          queue,
          queueIndex,
          volume: state.volume,
          waveMode: state.waveMode,
          shuffle: state.shuffle,
          repeat: state.repeat,
          context: state.context,
          originalQueue: sliceOriginalQueueForPersist(state.originalQueue, state.track?.id),
          currentTime: state.currentTime,
          duration: state.duration,
        };
      },
      // Через _setState (не мутацией) — иначе подписчики не узнают о restored.
      onRehydrateStorage: () => (state) => {
        if (state?.track) {
          state._setState({ restored: true, isPlaying: false, hasAudio: false, isLoading: false });
        }
      },
    },
  ),
);
