import Hls from 'hls.js';
import { usePlayerStore, type PlayerTrack } from '@/store/player';

let audio: HTMLAudioElement | null = null;
let hls: Hls | null = null;
let loadedTrackId: string | null = null;

export function initAudioEngine(): void {
  if (audio) return;

  audio = new Audio();
  audio.volume = usePlayerStore.getState().volume;

  audio.addEventListener('timeupdate', () => {
    usePlayerStore.getState()._setState({ currentTime: audio!.currentTime });
  });

  audio.addEventListener('durationchange', () => {
    if (isFinite(audio!.duration)) {
      usePlayerStore.getState()._setState({ duration: audio!.duration });
    }
  });

  audio.addEventListener('ended', () => controls.next());
  audio.addEventListener('playing', () =>
    usePlayerStore.getState()._setState({ isPlaying: true, isLoading: false }),
  );
  audio.addEventListener('pause', () =>
    usePlayerStore.getState()._setState({ isPlaying: false }),
  );
  audio.addEventListener('waiting', () =>
    usePlayerStore.getState()._setState({ isLoading: true }),
  );
  audio.addEventListener('canplay', () =>
    usePlayerStore.getState()._setState({ isLoading: false }),
  );
}

async function loadAndPlay(track: PlayerTrack): Promise<void> {
  if (!audio) return;

  usePlayerStore.getState()._setState({ isLoading: true, hasAudio: false, currentTime: 0, duration: 0, waveformPeaks: null });

  const res = await fetch(`/api/v1/tracks/${track.id}/manifest`).catch(() => null);

  if (!res?.ok) {
    usePlayerStore.getState()._setState({ isLoading: false });
    return;
  }

  const { hlsUrl, waveformPeaks } = (await res.json()) as { hlsUrl: string; waveformPeaks: number[] | null };
  usePlayerStore.getState()._setState({ waveformPeaks: waveformPeaks ?? null });

  if (hls) { hls.destroy(); hls = null; }

  usePlayerStore.getState()._setState({ hasAudio: true });

  if (Hls.isSupported()) {
    hls = new Hls();
    hls.loadSource(hlsUrl);
    hls.attachMedia(audio);
    hls.once(Hls.Events.MANIFEST_PARSED, () => {
      audio?.play().catch(() => {});
    });
  } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
    audio.src = hlsUrl;
    audio.play().catch(() => {});
  } else {
    usePlayerStore.getState()._setState({ hasAudio: false, isLoading: false });
  }
}

export const controls = {
  play(track: PlayerTrack, queue: PlayerTrack[] = [], index = 0): void {
    usePlayerStore.getState()._setState({
      track,
      queue: queue.length > 0 ? queue : [track],
      queueIndex: index,
    });

    if (track.id !== loadedTrackId) {
      loadedTrackId = track.id;
      loadAndPlay(track);
    } else if (audio) {
      audio.play().catch(() => {});
    }
  },

  togglePlay(): void {
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  },

  seek(time: number): void {
    if (audio) audio.currentTime = time;
    usePlayerStore.getState()._setState({ currentTime: time });
  },

  setVolume(volume: number): void {
    if (audio) audio.volume = volume;
    usePlayerStore.getState()._setState({ volume });
  },

  next(): void {
    const { queue, queueIndex } = usePlayerStore.getState();
    const i = queueIndex + 1;
    if (i < queue.length) controls.play(queue[i], queue, i);
  },

  prev(): void {
    if (audio && audio.currentTime > 3) {
      controls.seek(0);
      audio.play().catch(() => {});
    } else {
      const { queue, queueIndex } = usePlayerStore.getState();
      const i = queueIndex - 1;
      if (i >= 0) controls.play(queue[i], queue, i);
      else controls.seek(0);
    }
  },
};
