import type HlsType from 'hls.js';
import { usePlayerStore, type PlayerTrack, type PlayContext } from '@/store/player';
import { getSessionId } from '@/lib/session-id';
import { dedupeQueue, shuffleOn, shuffleOff, nextQueueIndex, capLiveQueue } from '@/lib/player/queue';
import { fetchManifest } from '@/lib/player/manifest-cache';
import { needsWaveFetch, fetchWaveTracks } from '@/lib/player/wave-buffer';

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

let playStartedAt: number | null = null;
let playStartedTrackId: string | null = null;
// source захватывается в момент СТАРТА воспроизведения: playQueue пишет новый
// context в стор ДО flushPlayEvent предыдущего трека, поэтому живой store.context
// в момент flush уже принадлежит следующему клику.
let playStartedSource = 'direct';
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

function flushPlayEvent(): void {
  if (!playStartedTrackId || playStartedAt === null) return;

  const durationPlayedSec = Math.round((Date.now() - playStartedAt) / 1000);
  const trackId = playStartedTrackId;
  const startedAt = new Date(playStartedAt).toISOString();
  const source = playStartedSource;

  playStartedAt = null;
  playStartedTrackId = null;

  fetch(`/api/v1/tracks/${trackId}/play`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: getSessionId(), source, durationPlayedSec, startedAt }),
  }).catch(() => {});
}

// ─── Буфер волны ─────────────────────────────────────────────────────────
// Дозапрос следующей партии треков волны — общая точка для проактивного триггера
// (needsWaveFetch на 'playing'/тике) и реактивного фолбэка (next() при пустой очереди).
// waveFetchInFlight — единственный in-flight-guard на оба пути; awaitingNextFromBuffer
// подхватывает результат, если next() встал в очередь, пока фетч уже летел.
let waveFetchInFlight = false;
let awaitingNextFromBuffer = false;
let consecutiveWaveErrors = 0;

const WAVE_SID_KEY = 'vire_wave_sid';

function getWaveSessionId(): string {
  let sid = sessionStorage.getItem(WAVE_SID_KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem(WAVE_SID_KEY, sid);
  }
  return sid;
}

/** «Проигранное» для анти-повтора волны — id очереди до текущего трека включительно. */
function playedIdsForWaveRequest(): string[] {
  const { queue, queueIndex } = usePlayerStore.getState();
  return queue.slice(0, queueIndex + 1).map((t) => t.id).slice(-100);
}

async function growWaveBuffer(): Promise<PlayerTrack[]> {
  const { track } = usePlayerStore.getState();
  if (!track) return usePlayerStore.getState().queue;

  waveFetchInFlight = true;
  try {
    const tracks = await fetchWaveTracks({
      sessionId: getWaveSessionId(),
      trackId: track.id,
      played: playedIdsForWaveRequest(),
      count: 3,
    });
    if (tracks.length === 0) return usePlayerStore.getState().queue;

    const current = usePlayerStore.getState();
    const mergedQueue = dedupeQueue([...current.queue, ...tracks]);
    // Шаффл активен — новые треки дозаписываем и в originalQueue, иначе выключение
    // шаффла (shuffleOff) их потеряет.
    const mergedOriginal =
      current.shuffle && current.originalQueue ? dedupeQueue([...current.originalQueue, ...tracks]) : null;
    // Волна дозаписывает бесконечно — капаем длину в памяти, иначе долгая сессия
    // растит очередь без предела.
    const capped = capLiveQueue(mergedQueue, current.queueIndex, mergedOriginal);
    const patch: { queue: PlayerTrack[]; queueIndex: number; originalQueue?: PlayerTrack[] | null } = {
      queue: capped.queue,
      queueIndex: capped.queueIndex,
    };
    if (mergedOriginal) patch.originalQueue = capped.originalQueue;
    usePlayerStore.getState()._setState(patch);
    return capped.queue;
  } finally {
    waveFetchInFlight = false;
    if (awaitingNextFromBuffer) {
      awaitingNextFromBuffer = false;
      const s = usePlayerStore.getState();
      const idx = s.queueIndex + 1;
      if (idx < s.queue.length) playAt(s.queue, idx);
      else usePlayerStore.getState()._setState({ isLoading: false });
    }
  }
}

async function maybeFetchWaveBuffer(): Promise<void> {
  const { queue, queueIndex, waveMode } = usePlayerStore.getState();
  if (!needsWaveFetch(queue.length, queueIndex, waveMode, waveFetchInFlight)) return;
  await growWaveBuffer();
}

function handleWaveLoadError(): void {
  consecutiveWaveErrors += 1;
  if (consecutiveWaveErrors >= 3) {
    consecutiveWaveErrors = 0;
    usePlayerStore.getState()._setState({ audioError: true, isLoading: false });
    return;
  }
  void controls.next();
}

// ─── Префетч манифеста следующего трека ────────────────────────────────────
let prefetchedAheadFor: string | null = null;

function maybePrefetchNextManifest(): void {
  const { queue, queueIndex, duration, currentTime, track } = usePlayerStore.getState();
  if (!track || duration <= 0) return;
  if (duration - currentTime >= 15) return;
  if (prefetchedAheadFor === track.id) return;
  const next = queue[queueIndex + 1];
  if (!next) return;
  prefetchedAheadFor = track.id;
  void fetchManifest(next.id);
}

// ─── Тик раз в ~5с при воспроизведении ──────────────────────────────────────
// Общий редкий throttle для проверок, которым не нужна покадровая частота
// timeupdate: буфер волны, префетч манифеста и персист currentTime в стор.
// Живой UI (прогресс-бар/waveform/тексты) читает время мимо стора через
// useAudioTime — стор нужен только для восстановления позиции после reload.
const TICK_INTERVAL_MS = 5_000;
let lastTickAt = 0;

function runThrottledTick(): void {
  const now = Date.now();
  if (now - lastTickAt < TICK_INTERVAL_MS) return;
  lastTickAt = now;

  if (!usePlayerStore.getState().isPlaying) return;
  usePlayerStore.getState()._setState({ currentTime: audio?.currentTime ?? 0 });
  void maybeFetchWaveBuffer();
  maybePrefetchNextManifest();
}

export function initAudioEngine(): void {
  if (audio) return;

  audio = new Audio();
  audio.volume = usePlayerStore.getState().volume;

  audio.addEventListener('timeupdate', runThrottledTick);

  audio.addEventListener('durationchange', () => {
    if (isFinite(audio!.duration)) {
      usePlayerStore.getState()._setState({ duration: audio!.duration });
    }
  });

  audio.addEventListener('ended', () => {
    flushPlayEvent();
    stopHeartbeat();
    // repeat='one': не переход по очереди, а перезапуск того же трека — flushPlayEvent
    // уже сбросил playStartedTrackId, поэтому 'playing' заново взведёт play-event/heartbeat.
    if (usePlayerStore.getState().repeat === 'one') {
      controls.seek(0);
      audio?.play().catch(() => {});
      return;
    }
    void controls.next();
  });
  audio.addEventListener('playing', () => {
    clearLoadWatchdog();
    consecutiveWaveErrors = 0;
    usePlayerStore.getState()._setState({ isPlaying: true, isLoading: false });
    const { track, context } = usePlayerStore.getState();
    if (track && track.id !== playStartedTrackId) {
      playStartedAt = Date.now();
      playStartedTrackId = track.id;
      playStartedSource = context?.source ?? 'direct';
    }
    if (track) startHeartbeat(track.id);
    void maybeFetchWaveBuffer();
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

async function attachAndPlay(track: PlayerTrack, opts: { seekTo?: number } = {}): Promise<void> {
  if (!audio) return;

  flushPlayEvent();

  prefetchedAheadFor = null;
  // Резюм восстановленного трека (opts.seekTo передаётся только из resumeRestored):
  // duration уже персистится в сторе с прошлой сессии — не сбрасываем в 0, иначе
  // мини-бар на кадр покажет 0:00/0:00 до реального durationchange (ждём сеть).
  // currentTime сбрасывать не нужно — сюда же приходит опция seekTo.
  const isResume = opts.seekTo !== undefined;
  usePlayerStore.getState()._setState({
    isLoading: true,
    hasAudio: false,
    audioError: false,
    currentTime: opts.seekTo ?? 0,
    ...(isResume ? {} : { duration: 0 }),
    waveformPeaks: null,
  });
  armLoadWatchdog();

  const manifest = await fetchManifest(track.id);

  // Staleness guard: пока ждали сеть, playAt/resumeRestored могли переключить
  // loadedTrackId на другой трек — его attachAndPlay уже владеет hls/audio/стором,
  // наш вызов молча выходит (иначе побеждает тот, чей fetch завершился ПОЗЖЕ).
  if (loadedTrackId !== track.id) return;

  if (!manifest) {
    clearLoadWatchdog();
    usePlayerStore.getState()._setState({ isLoading: false, hasAudio: false, audioError: true });
    if (usePlayerStore.getState().waveMode) handleWaveLoadError();
    return;
  }

  usePlayerStore.getState()._setState({ waveformPeaks: manifest.waveformPeaks ?? null, hasAudio: true });

  if (hls) { hls.destroy(); hls = null; }

  const Hls = await getHls();
  if (loadedTrackId !== track.id) return;
  if (Hls.isSupported()) {
    // Часть исходников даёт «дыру» в медиа-буфере (gap в таймстампах, обычно в
    // начале) → bufferStalledError/bufferSeekOverHole, плеер залипает на 0:00.
    // Повышаем терпимость к дырам и число попыток перепрыгнуть их.
    hls = new Hls({ maxBufferHole: 0.5, nudgeOffset: 0.2, nudgeMaxRetry: 8 });
    hls.loadSource(manifest.hlsUrl);
    hls.attachMedia(audio);
    hls.once(Hls.Events.MANIFEST_PARSED, () => {
      if (opts.seekTo) audio!.currentTime = opts.seekTo;
      audio?.play().catch(() => {});
    });
    hls.on(Hls.Events.ERROR, (_evt, data) => {
      // Логируем нефатальные ошибки для диагностики, но НЕ benign-восстановление:
      // bufferSeekOverHole/bufferNudgeOnStall — это hls.js успешно перепрыгнул дыру,
      // не сбой (иначе консоль «кричит» при нормальном воспроизведении).
      const benign = data.details === 'bufferSeekOverHole' || data.details === 'bufferNudgeOnStall';
      if (!benign) {
        console.warn('[player] HLS error', data.type, data.details, 'fatal:', data.fatal);
      }

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
        if (usePlayerStore.getState().waveMode) handleWaveLoadError();
      }
    });
  } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
    audio.src = manifest.hlsUrl;
    if (opts.seekTo) audio.currentTime = opts.seekTo;
    audio.play().catch(() => {});
  } else {
    usePlayerStore.getState()._setState({ hasAudio: false, isLoading: false });
  }
}

function playAt(queue: PlayerTrack[], index: number): void {
  const track = queue[index];
  if (!track) return;

  usePlayerStore.getState()._setState({ track, queue, queueIndex: index });

  if (track.id !== loadedTrackId) {
    loadedTrackId = track.id;
    void attachAndPlay(track);
  } else if (audio) {
    // Уже загруженный трек: playQueue/повторный клик «Играть» по той же очереди
    // резюмит с текущей позиции, а не рестартит с 0:00 (playAt вызывается не
    // только из repeat-обёртки next(), но и напрямую из UI — release-hero-play,
    // featured-play-button, playlist playAll и т.п.). Рестарт с 0 — точечно в next().
    audio.play().catch(() => {});
  }
}

/** После регидрации persist queue[queueIndex] может не совпадать с track (очередь
 *  усечена до 100 при сохранении) — чиним индекс по фактической позиции трека. */
function clampRestoredQueueIndex(): void {
  const { track, queue, queueIndex } = usePlayerStore.getState();
  if (!track) return;
  const atIndex = queue[queueIndex];
  if (atIndex && atIndex.id === track.id) return;
  const found = queue.findIndex((t) => t.id === track.id);
  usePlayerStore.getState()._setState({ queueIndex: found >= 0 ? found : 0 });
}

export function getAudioTime(): number {
  return audio?.currentTime ?? 0;
}

export const controls = {
  playQueue(tracks: PlayerTrack[], opts: { startIndex?: number; context: PlayContext; shuffle?: boolean }): void {
    initAudioEngine();
    if (tracks.length === 0) return;
    // Индекс резолвим по id ДО дедупа: если исходная очередь содержит дубликаты
    // раньше нужной позиции, dedupeQueue сдвинет индексы — позиционный startIndex
    // после дедупа указал бы уже на другой трек.
    const rawStart = Math.min(Math.max(opts.startIndex ?? 0, 0), tracks.length - 1);
    const startTrackId = tracks[rawStart].id;
    const deduped = dedupeQueue(tracks);
    if (deduped.length === 0) return;
    const startIndex = Math.max(0, deduped.findIndex((t) => t.id === startTrackId));

    let queue = deduped;
    let index = startIndex;
    // Каждый playQueue — новая, конечная очередь: волна и шаффл предыдущего
    // проигрывания к ней не относятся (иначе волна навсегда дозаписывает
    // конец любой очереди, а шаффл остаётся включённым со стухшим originalQueue).
    const patch: {
      context: PlayContext;
      waveMode: false;
      waveSeed: null;
      shuffle: boolean;
      originalQueue: PlayerTrack[] | null;
    } = {
      context: opts.context,
      waveMode: false,
      waveSeed: null,
      shuffle: false,
      originalQueue: null,
    };

    if (opts.shuffle) {
      const result = shuffleOn(deduped, startIndex);
      queue = result.queue;
      index = result.index;
      patch.shuffle = true;
      patch.originalQueue = deduped;
    }

    usePlayerStore.getState()._setState(patch);
    playAt(queue, index);
  },

  /** Toggle-if-current: пауза/плей у уже загруженного трека; для чужого id — no-op. */
  toggle(trackId?: string): void {
    const { track } = usePlayerStore.getState();
    if (!track) return;
    if (trackId !== undefined && trackId !== track.id) return;
    controls.togglePlay();
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
    const { queue, queueIndex, waveMode, track, repeat } = usePlayerStore.getState();

    // Волна главнее repeat='all' — она сама дозапрашивает буфер вместо зацикливания.
    if (!waveMode) {
      const idx = nextQueueIndex(queueIndex, queue.length, repeat);
      if (idx === null) return;
      if (idx === queueIndex) {
        // repeat='all' с очередью из одного трека — nextQueueIndex зацикливает на
        // тот же index, playAt по уже загруженному треку просто резюмит (не
        // рестартит), поэтому явный рестарт с 0 нужен именно здесь.
        controls.seek(0);
        audio?.play().catch(() => {});
        return;
      }
      playAt(queue, idx);
      return;
    }

    const i = queueIndex + 1;
    if (i < queue.length) {
      playAt(queue, i);
      return;
    }

    if (!track) return;

    if (waveFetchInFlight) {
      awaitingNextFromBuffer = true;
      usePlayerStore.getState()._setState({ isLoading: true });
      return;
    }

    usePlayerStore.getState()._setState({ isLoading: true });
    const mergedQueue = await growWaveBuffer();
    const idx = queueIndex + 1;
    if (idx < mergedQueue.length) {
      playAt(mergedQueue, idx);
    } else {
      usePlayerStore.getState()._setState({ isLoading: false });
    }
  },

  prev(): void {
    if (audio && audio.currentTime > 3) {
      controls.seek(0);
      audio.play().catch(() => {});
      return;
    }
    const { queue, queueIndex } = usePlayerStore.getState();
    const i = queueIndex - 1;
    if (i >= 0) playAt(queue, i);
    else controls.seek(0);
  },

  /** Оставлено для WaveModeButton — продолжить волну для уже играющей очереди без перезапуска. */
  setWaveMode(on: boolean): void {
    usePlayerStore.getState()._setState(on ? { waveMode: true } : { waveMode: false, waveSeed: null });
  },

  cycleRepeat(): void {
    const { repeat } = usePlayerStore.getState();
    const next = repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off';
    usePlayerStore.getState()._setState({ repeat: next });
  },

  toggleShuffle(): void {
    const { shuffle, queue, queueIndex, track, originalQueue } = usePlayerStore.getState();
    if (shuffle) {
      const base = originalQueue ?? queue;
      const result = shuffleOff(base, track?.id ?? '');
      usePlayerStore.getState()._setState({
        shuffle: false,
        queue: result.queue,
        queueIndex: result.index,
        originalQueue: null,
      });
    } else {
      const result = shuffleOn(queue, queueIndex);
      usePlayerStore.getState()._setState({
        shuffle: true,
        queue: result.queue,
        queueIndex: result.index,
        originalQueue: queue,
      });
    }
  },

  /** Запускает волну как новую очередь: каждый явный запуск пробует свежий
   *  кандидат-sid, но записывает его в sessionStorage ('vire_wave_sid') только
   *  при успешном старте (tracks.length>0) — неудачный фетч не должен оставить
   *  играющую волну (старую очередь) без серверного анти-повтора нового sid. */
  async startWave(seed: { mood?: string; genre?: string } | null): Promise<boolean> {
    const candidateSid = crypto.randomUUID();
    const tracks = await fetchWaveTracks({
      sessionId: candidateSid,
      mood: seed?.mood,
      genre: seed?.genre,
      played: [],
      count: 3,
    });
    if (tracks.length === 0) return false;

    sessionStorage.setItem(WAVE_SID_KEY, candidateSid);
    controls.playQueue(tracks, { context: { source: 'wave' } });
    usePlayerStore.getState()._setState({ waveMode: true, waveSeed: seed });
    return true;
  },

  stopWave(): void {
    usePlayerStore.getState()._setState({ waveMode: false, waveSeed: null });
  },

  /** Первый play после гидрации persist: подгружает манифест текущего трека,
   *  восстанавливает позицию и играет. Вызывается UI (B4/D2). */
  resumeRestored(): void {
    const { track, currentTime } = usePlayerStore.getState();
    if (!track || track.id === loadedTrackId) return;

    clampRestoredQueueIndex();
    initAudioEngine();
    loadedTrackId = track.id;
    usePlayerStore.getState()._setState({ restored: false });
    void attachAndPlay(track, { seekTo: currentTime });
  },
};
