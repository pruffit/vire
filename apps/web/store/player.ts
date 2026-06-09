import { create } from 'zustand';

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
  waveMode: false,
  _setState: (patch) => set(patch),
}));
