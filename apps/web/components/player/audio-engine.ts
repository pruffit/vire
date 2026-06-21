import type HlsType from 'hls.js';
import { usePlayerStore, type PlayerTrack } from '@/store/player';

let audio: HTMLAudioElement | null = null;
let hls: HlsType | null = null;
// hls.js (~190 КиБ) подгружается только при первом воспроизведении, не в начальном бандле
let HlsClass: typeof HlsType | null = null;

async function getHls(): Promise<typeof HlsType> {
  if (!HlsClass) HlsClass = (await import('hls.js')).default;
  return HlsClass;
}
let loadedTrackId: string | null = null;

// Watchdog загрузки: если за это время трек так и не заиграл (битые/недокачанные
// HLS-сегменты, висящий запрос), показываем ошибку вместо вечного спиннера.
const LOAD_TIMEOUT_MS = 20_000;
let loadWatchdog: ReturnType<typeof setTimeout> | null = null;

function clearLoadWatchdog(): void {
  if (loadWatchdog) {
    clearTimeout(loadWatchdog);
    loadWatchdog = null;
  }
}

function armLoadWatchdog(): void {
  clearLoadWatchdog();
  loadWatchdog = setTimeout(() => {
    const s = usePlayerStore.getState();
    // Сработал, а трек всё ещё грузится и не играет — значит залип.
    if (s.isLoading && !s.isPlaying) {
      usePlayerStore.getState()._setState({ isLoading: false, hasAudio: false, audioError: true });
      if (hls) { hls.destroy(); hls = null; }
    }
  }, LOAD_TIMEOUT_MS);
}

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

  const data = await res.json() as { track: { id: string; title: string; artistName: string; artistSlug: string; releaseId: string; coverUrl: string | null; accentColor: string | null; isExplicit?: boolean } | null };
  if (!data.track) return null;

  return {
    id: data.track.id,
    title: data.track.title,
    artistName: data.track.artistName,
    coverUrl: data.track.coverUrl,
    artistSlug: data.track.artistSlug,
    releaseId: data.track.releaseId,
    accentColor: data.track.accentColor ?? undefined,
    isExplicit: data.track.isExplicit,
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
    clearLoadWatchdog();
    usePlayerStore.getState()._setState({ isPlaying: true, isLoading: false });
    const { track } = usePlayerStore.getState();
    if (track && track.id !== playStartedTrackId) {
      playStartedAt = Date.now();
      playStartedTrackId = track.id;
    }
    if (track) startHeartbeat(track.id);
  });
  audio.addEventListener('pause', () => {
    clearLoadWatchdog();
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
  armLoadWatchdog();

  const res = await fetch(`/api/v1/tracks/${track.id}/manifest`).catch(() => null);

  if (!res?.ok) {
    clearLoadWatchdog();
    usePlayerStore.getState()._setState({ isLoading: false, hasAudio: false, audioError: true });
    return;
  }

  const { hlsUrl, waveformPeaks } = (await res.json()) as { hlsUrl: string; waveformPeaks: number[] | null };
  usePlayerStore.getState()._setState({ waveformPeaks: waveformPeaks ?? null });

  if (hls) { hls.destroy(); hls = null; }

  usePlayerStore.getState()._setState({ hasAudio: true });

  const Hls = await getHls();
  if (Hls.isSupported()) {
    // Часть исходников даёт «дыру» в медиа-буфере (gap в таймстампах, обычно в
    // начале) → bufferStalledError/bufferSeekOverHole, плеер залипает на 0:00.
    // Повышаем терпимость к дырам и число попыток перепрыгнуть их.
    hls = new Hls({ maxBufferHole: 0.5, nudgeOffset: 0.2, nudgeMaxRetry: 8 });
    hls.loadSource(hlsUrl);
    hls.attachMedia(audio);
    hls.once(Hls.Events.MANIFEST_PARSED, () => {
      audio?.play().catch(() => {});
    });
    hls.on(Hls.Events.ERROR, (_evt, data) => {
      // Логируем ВСЕ ошибки, включая нефатальные: иначе проблемы с сегментами
      // (битый/отсутствующий чанк, залипший буфер) молча проглатываются — отсюда
      // «бесконечная загрузка без ошибок в консоли».
      console.warn('[player] HLS error', data.type, data.details, 'fatal:', data.fatal);

      // Залип на дыре в начале буфера: данных в текущей позиции нет, но первый
      // буферизованный диапазон начинается позже → перепрыгиваем на его старт.
      if (!data.fatal && data.details === 'bufferStalledError' && audio) {
        try {
          const b = audio.buffered;
          if (b.length > 0 && audio.currentTime < b.start(0)) {
            audio.currentTime = b.start(0) + 0.01;
            audio.play().catch(() => {});
          }
        } catch { /* buffered может бросить, если медиа ещё не готово */ }
      }

      if (data.fatal) {
        clearLoadWatchdog();
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
