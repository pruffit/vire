import { create } from 'zustand';
import { trackManifestResponseSchema } from '@vire/api-contracts';
import { nextQueueIndex } from '@vire/core/playback/queue';
import { apiRequest } from './api-client';
import { audioEngine, type AudioTimeUpdate } from './audio-engine';

export interface QueueTrack {
  id: string;
  title: string;
  artistName: string;
  coverUrl: string | null;
  durationSec: number | null;
}

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

interface PlayerState {
  queue: QueueTrack[];
  queueIndex: number;
  status: PlaybackStatus;
  positionSec: number;
  durationSec: number;
  playQueue: (tracks: QueueTrack[], startIndex: number) => Promise<void>;
  togglePlayPause: () => void;
  next: () => void;
  prev: () => void;
  seek: (sec: number) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  queueIndex: -1,
  status: 'idle',
  positionSec: 0,
  durationSec: 0,

  playQueue: async (tracks, startIndex) => {
    if (tracks.length === 0) return;
    const index = Math.min(Math.max(startIndex, 0), tracks.length - 1);
    set({ queue: tracks, queueIndex: index });
    await loadAndPlay(index);
  },

  togglePlayPause: () => {
    const { status, queueIndex } = get();
    if (status === 'playing') {
      audioEngine.pause();
      set({ status: 'paused' });
    } else if (status === 'paused') {
      audioEngine.play();
      set({ status: 'playing' });
    } else if (status === 'error') {
      // Тап по play в состоянии ошибки — повторная попытка того же трека, не молчание.
      loadAndPlay(queueIndex);
    }
  },

  next: () => {
    const { queue, queueIndex } = get();
    const index = nextQueueIndex(queueIndex, queue.length, 'off');
    if (index === null) {
      set({ status: 'paused' });
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
}));

// Драйвер может отдать один-два timeupdate со старой позицией в момент, когда seekTo()
// уже вызван, но нативный плеер ещё не догнал новую позицию (гонка на HLS — поиск нужного
// сегмента не мгновенный). Короткое окно после ручного seek — timeupdate из движка не
// перетирает оптимистично выставленную позицию.
const SEEK_GUARD_MS = 500;
let seekGuardUntil = 0;

/** Только для тестов — модульное состояние guard'а не входит в zustand-стор и не
 * сбрасывается обычным usePlayerStore.setState(). */
export function __resetSeekGuardForTests(): void {
  seekGuardUntil = 0;
}

async function loadAndPlay(index: number): Promise<void> {
  const track = usePlayerStore.getState().queue[index];
  if (!track) return;
  usePlayerStore.setState({ status: 'loading', positionSec: 0, durationSec: track.durationSec ?? 0 });

  // apiRequest (Bearer + refresh), не голый request — трек может быть непубличным
  // (черновик/WIP), тогда манифест отдаётся только владельцу/стаффу по личности вызывающего.
  const result = await apiRequest(`/api/v1/tracks/${track.id}/manifest`, {
    schema: trackManifestResponseSchema,
  });
  // За время запроса индекс мог смениться (быстрый next/prev) — устаревший ответ не проигрываем.
  if (usePlayerStore.getState().queueIndex !== index) return;
  if (!result.ok) {
    console.error('[player] не удалось получить манифест трека', track.id, result.error);
    usePlayerStore.setState({ status: 'error' });
    return;
  }

  try {
    await audioEngine.load({
      manifestUrl: result.data.hlsUrl,
      title: track.title,
      artist: track.artistName,
      artworkUrl: track.coverUrl ?? undefined,
    });
    if (usePlayerStore.getState().queueIndex !== index) return;
    await audioEngine.play();
    usePlayerStore.setState({ status: 'playing' });
  } catch (err) {
    console.error('[player] load/play упал', track.id, err);
    if (usePlayerStore.getState().queueIndex === index) usePlayerStore.setState({ status: 'error' });
  }
}

audioEngine.on('timeupdate', (payload) => {
  if (Date.now() < seekGuardUntil) return;
  const { currentTime, duration } = payload as AudioTimeUpdate;
  usePlayerStore.setState({ positionSec: currentTime, durationSec: duration });
});

audioEngine.on('ended', () => {
  usePlayerStore.getState().next();
});

audioEngine.on('error', (payload) => {
  console.error('[player] audioEngine error-событие', payload);
  usePlayerStore.setState({ status: 'error' });
});

// Команды next/prev с lock-screen/уведомления/наушников — очередью владеет стор, не
// движок (см. докстринг IAudioEngine), поэтому remote-события транслируются в те же
// переходы, что и тап по кнопкам в приложении.
audioEngine.on('remoteNext', () => {
  usePlayerStore.getState().next();
});

audioEngine.on('remotePrevious', () => {
  usePlayerStore.getState().prev();
});

// Play/Pause с lock-screen применяются движком напрямую к нативному плееру (не через
// togglePlayPause) — statechange синхронизирует status стора с реальным состоянием,
// откуда бы оно ни пришло. loading/error не перетираем: транзитное статус-событие от
// предыдущего трека может прилететь уже после того, как стор ушёл в загрузку следующего.
audioEngine.on('statechange', (payload) => {
  const { status } = usePlayerStore.getState();
  if (status === 'loading' || status === 'error') return;
  const { isPlaying } = payload as { isPlaying: boolean };
  usePlayerStore.setState({ status: isPlaying ? 'playing' : 'paused' });
});
