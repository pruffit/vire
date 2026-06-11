import Hls from 'hls.js';
import { usePlayerStore, type PlayerTrack } from '@/store/player';

let audio: HTMLAudioElement | null = null;
let hls: Hls | null = null;
let loadedTrackId: string | null = null;

function getSessionId(): string {
  const key = 'vire_sid';
  let sid = sessionStorage.getItem(key);
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem(key, sid);
  }
  return sid;
}

let playStartedAt: number | null = null;
let playStartedTrackId: string | null = null;
let _savedVolume = 1;

// ─── Live-присутствие «слушают сейчас» ──────────────────────────────────────
// Пока трек играет, шлём heartbeat в presence-эндпоинт. Окно на сервере 45с,
// поэтому 20с с запасом переживают один пропущенный тик. На паузе/смене/конце
// останавливаем — присутствие истекает само.
const HEARTBEAT_MS = 20_000;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatTrackId: string | null = null;

function sendHeartbeat(trackId: string): void {
  fetch(`/api/v1/tracks/${trackId}/listening`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: getSessionId() }),
    keepalive: true,
  }).catch(() => {});
}

function startHeartbeat(trackId: string): void {
  if (heartbeatTrackId === trackId && heartbeatTimer) return;
  stopHeartbeat();
  heartbeatTrackId = trackId;
  sendHeartbeat(trackId); // сразу, не дожидаясь первого интервала
  heartbeatTimer = setInterval(() => sendHeartbeat(trackId), HEARTBEAT_MS);
}

function stopHeartbeat(): void {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
  heartbeatTrackId = null;
}

// История треков в текущей сессии — для wave (не повторяем уже сыгранное)
const waveHistory: string[] = [];

function flushPlayEvent(source: string = 'direct'): void {
  if (!playStartedTrackId || playStartedAt === null) return;

  const durationPlayedSec = Math.round((Date.now() - playStartedAt) / 1000);
  const trackId = playStartedTrackId;
  const startedAt = new Date(playStartedAt).toISOString();

  playStartedAt = null;
  playStartedTrackId = null;

  fetch(`/api/v1/tracks/${trackId}/play`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: getSessionId(), source, durationPlayedSec, startedAt }),
  }).catch(() => {});
}

/** Запрашивает следующий трек у волны когда очередь исчерпана. */
async function fetchWaveNext(currentTrackId: string): Promise<PlayerTrack | null> {
  const played = waveHistory.slice(-30).join(',');
  const url = `/api/v1/wave?trackId=${currentTrackId}${played ? `&played=${played}` : ''}`;

  const res = await fetch(url).catch(() => null);
  if (!res?.ok) return null;

  const data = await res.json() as { track: { id: string; title: string; artistName: string; artistSlug: string; releaseId: string; coverUrl: string | null; accentColor: string | null } | null };
  if (!data.track) return null;

  return {
    id: data.track.id,
    title: data.track.title,
    artistName: data.track.artistName,
    coverUrl: data.track.coverUrl,
    artistSlug: data.track.artistSlug,
    releaseId: data.track.releaseId,
    accentColor: data.track.accentColor ?? undefined,
  };
}

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

  audio.addEventListener('ended', () => {
    flushPlayEvent('direct');
    stopHeartbeat();
    controls.next();
  });
  audio.addEventListener('playing', () => {
    usePlayerStore.getState()._setState({ isPlaying: true, isLoading: false });
    const { track } = usePlayerStore.getState();
    if (track && track.id !== playStartedTrackId) {
      playStartedAt = Date.now();
      playStartedTrackId = track.id;
    }
    if (track) startHeartbeat(track.id);
  });
  audio.addEventListener('pause', () => {
    usePlayerStore.getState()._setState({ isPlaying: false });
    stopHeartbeat();
  });
  audio.addEventListener('waiting', () =>
    usePlayerStore.getState()._setState({ isLoading: true }),
  );
  audio.addEventListener('canplay', () =>
    usePlayerStore.getState()._setState({ isLoading: false }),
  );
}

async function loadAndPlay(track: PlayerTrack): Promise<void> {
  if (!audio) return;

  flushPlayEvent('direct');

  usePlayerStore.getState()._setState({ isLoading: true, hasAudio: false, audioError: false, currentTime: 0, duration: 0, waveformPeaks: null });

  const res = await fetch(`/api/v1/tracks/${track.id}/manifest`).catch(() => null);

  if (!res?.ok) {
    usePlayerStore.getState()._setState({ isLoading: false, hasAudio: false, audioError: true });
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
    hls.on(Hls.Events.ERROR, (_evt, data) => {
      if (data.fatal) {
        usePlayerStore.getState()._setState({ isLoading: false, hasAudio: false, audioError: true });
        hls?.destroy();
        hls = null;
      }
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

    // Добавляем в историю волны
    if (!waveHistory.includes(track.id)) {
      waveHistory.push(track.id);
    }

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

  toggleMute(): void {
    const { volume } = usePlayerStore.getState();
    if (volume > 0) {
      _savedVolume = volume;
      controls.setVolume(0);
    } else {
      controls.setVolume(_savedVolume || 1);
    }
  },

  async next(): Promise<void> {
    const { queue, queueIndex, track: currentTrack, waveMode } = usePlayerStore.getState();
    const i = queueIndex + 1;

    if (i < queue.length) {
      controls.play(queue[i], queue, i);
      return;
    }

    // Очередь исчерпана — если wave mode включён, запрашиваем следующий
    if (waveMode && currentTrack) {
      usePlayerStore.getState()._setState({ isLoading: true });
      const next = await fetchWaveNext(currentTrack.id);
      if (next) {
        // Добавляем в очередь и играем
        const newQueue = [...queue, next];
        usePlayerStore.getState()._setState({ queue: newQueue, queueIndex: newQueue.length - 1 });
        controls.play(next, newQueue, newQueue.length - 1);
      } else {
        usePlayerStore.getState()._setState({ isLoading: false });
      }
    }
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

  setWaveMode(on: boolean): void {
    usePlayerStore.getState()._setState({ waveMode: on });
  },
};
