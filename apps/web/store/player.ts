import { create } from 'zustand';

export interface PlayerTrack {
  id: string;
  title: string;
  artistName: string;
  coverUrl: string | null;
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
}

interface Store extends State {
  _setState(patch: Partial<State>): void;
}

export const usePlayerStore = create<Store>((set) => ({
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
  _setState: (patch) => set(patch),
}));
