import { create } from 'zustand';
import { request } from '@vire/api-client';
import { trackManifestResponseSchema } from '@vire/api-contracts';
import { nextQueueIndex } from '@vire/core/playback/queue';
import { API_BASE_URL } from './env';
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
    const { status } = get();
    if (status === 'playing') {
      audioEngine.pause();
      set({ status: 'paused' });
    } else if (status === 'paused') {
      audioEngine.play();
      set({ status: 'playing' });
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
    set({ positionSec: sec });
  },
}));

async function loadAndPlay(index: number): Promise<void> {
  const track = usePlayerStore.getState().queue[index];
  if (!track) return;
  usePlayerStore.setState({ status: 'loading', positionSec: 0, durationSec: track.durationSec ?? 0 });

  const result = await request(`${API_BASE_URL}/api/v1/tracks/${track.id}/manifest`, {
    schema: trackManifestResponseSchema,
  });
  // За время запроса индекс мог смениться (быстрый next/prev) — устаревший ответ не проигрываем.
  if (usePlayerStore.getState().queueIndex !== index) return;
  if (!result.ok) {
    usePlayerStore.setState({ status: 'error' });
    return;
  }

  try {
    await audioEngine.load({ manifestUrl: result.data.hlsUrl });
    if (usePlayerStore.getState().queueIndex !== index) return;
    await audioEngine.play();
    usePlayerStore.setState({ status: 'playing' });
  } catch {
    if (usePlayerStore.getState().queueIndex === index) usePlayerStore.setState({ status: 'error' });
  }
}

audioEngine.on('timeupdate', (payload) => {
  const { currentTime, duration } = payload as AudioTimeUpdate;
  usePlayerStore.setState({ positionSec: currentTime, durationSec: duration });
});

audioEngine.on('ended', () => {
  usePlayerStore.getState().next();
});

audioEngine.on('error', () => {
  usePlayerStore.setState({ status: 'error' });
});
