import { AppState } from 'react-native';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { trackManifestResponseSchema, type PlaySource } from '@vire/api-contracts';
import { nextQueueIndex, shuffleOn, shuffleOff, sliceWindowAroundIndex, type Repeat } from '@vire/core/playback/queue';
// Узкий подпуть, НЕ корневой баррель: он тянет весь @vire/core, включая @vire/i18n с
// динамическим импортом по шаблону, который Metro не умеет разобрать — бандл мобилки
// падает целиком. Тот же класс ограничения, что у edge-middleware веба.
import { clampRestoredQueueIndex } from '@vire/core/playback/engine-policy';
import { apiRequest } from './api-client';
import { audioEngine, setNotificationLikeState, type AudioTimeUpdate } from './audio-engine';
import { getDownloadedTrack } from './offline/download-manager';
import { fileStore } from './storage/file-store';
import { ListenTracker } from './playback/listen-tracker';
import { reportListen, flushPending } from './playback/play-reporter';
import { useLikesStore } from './likes-store';

export interface QueueTrack {
  id: string;
  title: string;
  artistName: string;
  coverUrl: string | null;
  durationSec: number | null;
  /** Акцент релиза — сцена красится сразу, не дожидаясь ответа сети. Не у всех источников
   *  очереди он под рукой, поэтому опционален; фолбэк — useTrackContext, затем нейтраль. */
  accentColor?: string | null;
}

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

/** Откуда запущено воспроизведение — для аналитики и «вернуться к источнику». Форма 1:1 с вебом. */
export interface PlayContext {
  source: PlaySource;
  sourceId?: string;
}

interface PlayerState {
  queue: QueueTrack[];
  queueIndex: number;
  status: PlaybackStatus;
  positionSec: number;
  durationSec: number;
  shuffle: boolean;
  repeat: Repeat;
  originalQueue: QueueTrack[] | null;
  context: PlayContext | null;
  /**
   * Состояние поднято из хранилища, но к движку не подключено: показываем трек, позицию и
   * длительность, а манифест догрузим по первому play. Иначе холодный старт тянул бы сеть
   * ради того, что пользователь мог и не собираться слушать.
   */
  restored: boolean;
  playQueue: (tracks: QueueTrack[], startIndex: number, context: PlayContext) => Promise<void>;
  /** Дописать хвост очереди, не трогая текущий трек и позицию: волна подливает треки по ходу. */
  appendToQueue: (tracks: QueueTrack[]) => void;
  togglePlayPause: () => void;
  next: () => void;
  prev: () => void;
  seek: (sec: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
}

/** Окно персиста — тем же кодом, что на вебе: очередь волны бывает бесконечной. */
const PERSIST_WINDOW = 60;
const PERSIST_BEFORE = 20;

const tracker = new ListenTracker();

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      queue: [],
      queueIndex: -1,
      status: 'idle',
      positionSec: 0,
      durationSec: 0,
      shuffle: false,
      repeat: 'off',
      originalQueue: null,
      context: null,
      restored: false,

      playQueue: async (tracks, startIndex, context) => {
        if (tracks.length === 0) return;
        const index = Math.min(Math.max(startIndex, 0), tracks.length - 1);
        // Новая очередь — новый заезд: шаффл сбрасывается, repeat остаётся (это постоянная
        // настройка слушателя, не свойство очереди).
        set({ queue: tracks, queueIndex: index, shuffle: false, originalQueue: null, context, restored: false });
        await loadAndPlay(index);
      },

      appendToQueue: (tracks) => {
        if (tracks.length === 0) return;
        const { queue, originalQueue } = get();
        const known = new Set(queue.map((t) => t.id));
        const fresh = tracks.filter((t) => !known.has(t.id));
        if (fresh.length === 0) return;
        // originalQueue живёт параллельно очереди под шаффлом — иначе выключение шаффла
        // откатило бы к очереди без долитого хвоста.
        set({
          queue: [...queue, ...fresh],
          originalQueue: originalQueue ? [...originalQueue, ...fresh] : null,
        });
      },

      // Ветки перечислены исчерпывающе намеренно: прежняя цепочка if/else if не покрывала
      // `idle`, и в этом состоянии кнопка play молча не делала ничего (найдено на устройстве).
      togglePlayPause: () => {
        const { status, queueIndex, restored } = get();
        if (queueIndex < 0 || status === 'loading') return;
        if (status === 'playing') {
          audioEngine.pause();
          set({ status: 'paused' });
          return;
        }
        // `restored` — очередь пришла из персиста, в движке ещё ничего нет: возобновлять
        // нечего, нужен полный load с сохранённой позиции.
        if (status === 'paused' && !restored) {
          audioEngine.play();
          set({ status: 'playing' });
          return;
        }
        loadAndPlay(queueIndex, restored ? get().positionSec : 0);
      },

      next: () => {
        const { queue, queueIndex, repeat } = get();
        const index = nextQueueIndex(queueIndex, queue.length, repeat);
        if (index === null) {
          set({ status: 'paused' });
          return;
        }
        if (index === queueIndex) {
          // repeat='all' на очереди из одного трека: loadAndPlay на том же индексе срежет
          // себя staleness-guard'ом, поэтому рестарт явный — без ре-фетча манифеста.
          audioEngine.seek(0);
          audioEngine.play();
          set({ status: 'playing', positionSec: 0 });
          return;
        }
        set({ queueIndex: index });
        loadAndPlay(index);
      },

      prev: () => {
        const { queueIndex } = get();
        if (queueIndex <= 0) return;
        const index = queueIndex - 1;
        set({ queueIndex: index });
        loadAndPlay(index);
      },

      seek: (sec) => {
        audioEngine.seek(sec);
        seekGuardUntil = Date.now() + SEEK_GUARD_MS;
        set({ positionSec: sec });
      },

      toggleShuffle: () => {
        const { shuffle, queue, queueIndex, originalQueue } = get();
        if (shuffle) {
          const base = originalQueue ?? queue;
          const currentId = queue[queueIndex]?.id ?? '';
          const result = shuffleOff(base, currentId);
          set({ shuffle: false, queue: result.queue, queueIndex: result.index, originalQueue: null });
        } else {
          const result = shuffleOn(queue, queueIndex);
          set({ shuffle: true, queue: result.queue, queueIndex: result.index, originalQueue: queue });
        }
      },

      cycleRepeat: () => {
        const { repeat } = get();
        set({ repeat: repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off' });
      },
    }),
    {
      name: 'vire-player',
      storage: createJSONStorage(() => fileStore),
      partialize: (s) => {
        const { items, index } = sliceWindowAroundIndex(s.queue, s.queueIndex, PERSIST_WINDOW, PERSIST_BEFORE);
        return {
          queue: items,
          queueIndex: index,
          positionSec: s.positionSec,
          durationSec: s.durationSec,
          shuffle: s.shuffle,
          repeat: s.repeat,
          context: s.context,
        };
      },
      onRehydrateStorage: () => (state) => {
        if (!state || state.queue.length === 0) return;
        // Индекс мог указывать за пределы усечённой очереди.
        usePlayerStore.setState({
          queueIndex: clampRestoredQueueIndex(state.queueIndex, state.queue.length),
          status: 'paused',
          restored: true,
        });
        // Прослушивания, не ушедшие в прошлый раз (офлайн), досылаем на старте.
        void flushPending();
      },
    },
  ),
);

const SEEK_GUARD_MS = 500;
let seekGuardUntil = 0;

export function __resetSeekGuardForTests(): void {
  seekGuardUntil = 0;
}

/** Закрывает учёт прошлого трека и отправляет событие. Сбой отчёта не трогает воспроизведение. */
function finishListen(): void {
  void reportListen(tracker.finish(Date.now()));
}

async function loadAndPlay(index: number, startAt = 0): Promise<void> {
  const state = usePlayerStore.getState();
  const track = state.queue[index];
  if (!track) return;

  finishListen();
  usePlayerStore.setState({
    status: 'loading',
    positionSec: startAt,
    durationSec: track.durationSec ?? 0,
    restored: false,
  });

  const downloaded = await getDownloadedTrack(track.id);
  if (usePlayerStore.getState().queueIndex !== index) return;

  let manifestUrl: string;
  if (downloaded) {
    manifestUrl = downloaded.localPlaylistPath;
  } else {
    // apiRequest, не голый request — трек может быть непубличным (черновик/WIP), тогда
    // манифест отдаётся только владельцу/стаффу по личности вызывающего.
    const result = await apiRequest(`/api/v1/tracks/${track.id}/manifest`, {
      schema: trackManifestResponseSchema,
    });
    if (usePlayerStore.getState().queueIndex !== index) return;
    if (!result.ok) {
      console.error('[player] не удалось получить манифест трека', track.id, result.error);
      usePlayerStore.setState({ status: 'error' });
      return;
    }
    manifestUrl = result.data.hlsUrl;
  }

  try {
    await audioEngine.load({
      manifestUrl,
      title: track.title,
      artist: track.artistName,
      artworkUrl: track.coverUrl ?? undefined,
      startAt: startAt > 0 ? startAt : undefined,
    });
    if (usePlayerStore.getState().queueIndex !== index) return;
    await audioEngine.play();
    tracker.start(track.id, state.context?.source ?? 'direct', Date.now());
    tracker.resume(Date.now());
    usePlayerStore.setState({ status: 'playing' });
    // Иконка лайка в шторке — сразу лучшее известное значение (кэш стора лайков), точное
    // придёт следом через likes-подписку в subscribePlayerEffects(), когда load() дозагрузит.
    useLikesStore.getState().load(track.id);
    setNotificationLikeState(!!useLikesStore.getState().state[track.id]);
  } catch (err) {
    console.error('[player] load/play упал', track.id, err);
    if (usePlayerStore.getState().queueIndex === index) usePlayerStore.setState({ status: 'error' });
  }
}

/**
 * Подписки стора на движок и жизненный цикл приложения.
 *
 * Вызывается из `App.tsx` эффектом с очисткой, а НЕ на уровне модуля. Причина найдена
 * живым прогоном: Metro при фаст-рефреше вычисляет модуль заново, создаёт новый
 * `ListenTracker` и вешает ВТОРОЙ набор слушателей на singleton `audioEngine`, не убрав
 * первый. Каждый набор отчитывался о прослушивании сам — в `play_events` приезжало по
 * восемь одинаковых строк вместо одной, то есть накрутка статистики.
 *
 * В release-сборке модуль вычисляется один раз, но полагаться на это нельзя: явная
 * подписка с очисткой дешевле и честнее молчаливого допущения.
 */
export function subscribePlayerEffects(): () => void {
  const offs = [
    audioEngine.on('timeupdate', (payload) => {
      if (Date.now() < seekGuardUntil) return;
      const { currentTime, duration } = payload as AudioTimeUpdate;
      usePlayerStore.setState({ positionSec: currentTime, durationSec: duration });
    }),

    audioEngine.on('ended', () => {
      finishListen();
      if (usePlayerStore.getState().repeat === 'one') {
        // Только естественное завершение зацикливает трек — ручные prev/next не подпадают.
        audioEngine.seek(0);
        audioEngine.play();
        const { queue, queueIndex, context } = usePlayerStore.getState();
        const track = queue[queueIndex];
        if (track) {
          tracker.start(track.id, context?.source ?? 'direct', Date.now());
          tracker.resume(Date.now());
        }
        usePlayerStore.setState({ status: 'playing', positionSec: 0 });
        return;
      }
      usePlayerStore.getState().next();
    }),

    audioEngine.on('error', (payload) => {
      console.error('[player] audioEngine error-событие', payload);
      finishListen();
      usePlayerStore.setState({ status: 'error' });
    }),

    // Команды с лок-скрина/наушников: очередью владеет стор, не движок.
    audioEngine.on('remoteNext', () => usePlayerStore.getState().next()),
    audioEngine.on('remotePrevious', () => usePlayerStore.getState().prev()),

    // Лайк из шторки — трек мог ни разу не показаться в UI, toggleRemote сам догрузит state.
    audioEngine.on('remoteLike', () => {
      const { queue, queueIndex } = usePlayerStore.getState();
      const track = queue[queueIndex];
      if (track) useLikesStore.getState().toggleRemote(track.id);
    }),

    audioEngine.on('statechange', (payload) => {
      const { status } = usePlayerStore.getState();
      if (status === 'loading' || status === 'error') return;
      const { isPlaying } = payload as { isPlaying: boolean };
      // Учёт идёт по РЕАЛЬНОМУ состоянию движка, откуда бы оно ни пришло — из приложения,
      // с лок-скрина или от аудиофокуса при звонке.
      if (isPlaying) tracker.resume(Date.now());
      else tracker.pause(Date.now());
      usePlayerStore.setState({ status: isPlaying ? 'playing' : 'paused' });
    }),
  ];

  // Уход в фон — последняя гарантированная точка отчитаться: дальше систему вправе убить
  // процесс. Учёт при этом НЕ закрывается: музыка в фоне продолжает играть.
  const appState = AppState.addEventListener('change', (next) => {
    if (next === 'active') {
      void flushPending();
      return;
    }
    const span = tracker.snapshot(Date.now());
    if (span) void reportListen(span);
  });

  // Лайк текущего трека изменился (из UI или из toggleRemote выше) — перерисовать иконку
  // в шторке. Только для трека, который сейчас играет: чужие лайки в другом месте приложения
  // MediaSession не касаются.
  const likesUnsub = useLikesStore.subscribe((state, prevState) => {
    const { queue, queueIndex } = usePlayerStore.getState();
    const track = queue[queueIndex];
    if (!track) return;
    const liked = state.state[track.id];
    if (liked !== prevState.state[track.id]) setNotificationLikeState(!!liked);
  });

  return () => {
    for (const off of offs) off();
    appState.remove();
    likesUnsub();
  };
}
