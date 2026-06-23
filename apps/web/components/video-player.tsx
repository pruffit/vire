'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { activeEmbedUrl, type EmbedInfo } from '@/lib/embed';
import { loadYouTubeApi, YT_STATE, type YTPlayer } from '@/lib/youtube-api';
import { loadVkPlayerApi, type VkPlayerInstance } from '@/lib/vk-player-api';
import { PlayIcon, PauseIcon } from '@/components/icons';
import { formatDuration } from '@/lib/format';
import { Icon } from '@/components/icon';

/**
 * Видео-плеер под стиль сайта: полностью свои контролы (play/pause, перемотка,
 * громкость, фуллскрин) поверх скрытых нативных. YouTube — IFrame Player API,
 * VK — Video Player API (js_api=1 + videoplayer.js); если их скрипт не
 * загрузился, VK деградирует до нативных контролов.
 */
export function VideoPlayer({ embed, title }: { embed: EmbedInfo; title?: string }) {
  if (embed.platform === 'youtube') return <YouTubePlayer videoId={embed.id} title={title} />;
  return <VkPlayer embed={embed} title={title} />;
}

/**
 * Жесты по слою клика: одиночный (с задержкой 250мс) — play/pause,
 * двойной по левой/правой трети — перемотка ∓10с, двойной по центру — фуллскрин.
 */
function useClickGestures({
  togglePlay,
  seekBy,
  toggleFullscreen,
}: {
  togglePlay: () => void;
  seekBy: (delta: number) => void;
  toggleFullscreen: () => void;
}) {
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;

    if (timerRef.current) {
      // второй клик — жест двойного клика
      clearTimeout(timerRef.current);
      timerRef.current = null;
      if (frac < 0.33) seekBy(-10);
      else if (frac > 0.67) seekBy(10);
      else toggleFullscreen();
      return;
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      togglePlay();
    }, 250);
  }, [togglePlay, seekBy, toggleFullscreen]);
}

/** Вуаль с постером поверх iframe на паузе/в конце/при загрузке —
 *  прячет нативный UI платформы (заголовки, оверлеи, «похожие видео»). */
function Veil({ posterUrl }: { posterUrl: string | null }) {
  return (
    <div className="absolute inset-0 z-[1] pointer-events-none bg-black">
      {posterUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={posterUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      <span className="absolute inset-0 bg-black/40" />
    </div>
  );
}

function YouTubePlayer({ videoId, title }: { videoId: string; title?: string }) {
  const [started, setStarted] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  // Вуаль скрывает нативный UI YouTube на паузе/в конце/до старта.
  // Буферизация вуаль не включает — иначе мигало бы при перемотке.
  const [veiled, setVeiled] = useState(true);
  // Ролик не запускается встраиваемым плеером (onError): чаще всего владелец
  // отключил встраивание (101/150), либо приватный/удалён (100). Показываем
  // фолбэк со ссылкой на YouTube вместо бесконечно мигающего постера.
  const [failed, setFailed] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [controlsShown, setControlsShown] = useState(true);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const pollRef = useRef<number | null>(null);
  const hideRef = useRef<number | null>(null);
  // Видео хоть раз дошло до PLAYING. До первого старта держим постер стабильно
  // (не снимаем вуаль на BUFFERING) — иначе постер мигает на медленной сети.
  const hasPlayedRef = useRef(false);

  // Создаём плеер императивно (YT заменяет наш узел на iframe — чтобы React не
  // конфликтовал с заменённым DOM, монтируем отдельный div вне реконсиляции).
  useEffect(() => {
    if (!started || !wrapperRef.current) return;
    let destroyed = false;
    const mount = document.createElement('div');
    wrapperRef.current.appendChild(mount);

    loadYouTubeApi().then((YT) => {
      if (destroyed) return;
      playerRef.current = new YT.Player(mount, {
        videoId,
        playerVars: {
          autoplay: 1, controls: 0, modestbranding: 1, rel: 0,
          playsinline: 1, fs: 0, iv_load_policy: 3, disablekb: 1,
        },
        events: {
          onReady: (e) => {
            setReady(true);
            setDuration(e.target.getDuration());
            setVolume(e.target.getVolume());
            setMuted(e.target.isMuted());
            e.target.playVideo();
          },
          onStateChange: (e) => {
            const s = e.data;
            const isPlaying = s === YT_STATE.PLAYING;
            setPlaying(isPlaying);
            if (isPlaying) hasPlayedRef.current = true;
            // Постер держим до первого реального старта и возвращаем только на
            // явной паузе/конце. BUFFERING после старта вуаль не включает
            // (бесшовная перемотка), а ДО старта — наоборот держит, иначе
            // «постер ↔ чёрный кадр» мигает на медленной сети.
            if (isPlaying) setVeiled(false);
            else if (s === YT_STATE.PAUSED || s === YT_STATE.ENDED) setVeiled(true);
            else if (s === YT_STATE.BUFFERING) setVeiled(!hasPlayedRef.current);
            else if (!hasPlayedRef.current) setVeiled(true); // UNSTARTED / CUED до старта
            if (s === YT_STATE.ENDED) setEnded(true);
            else if (isPlaying) setEnded(false);
            const d = e.target.getDuration();
            setDuration((prev) => (d && d !== prev ? d : prev));
          },
          onError: () => setFailed(true),
        },
      });
    });

    return () => {
      destroyed = true;
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch { /* noop */ }
        playerRef.current = null;
      }
    };
  }, [started, videoId]);

  // Тик прогресса, пока играет
  useEffect(() => {
    if (!playing) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    pollRef.current = window.setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      setCurrent(p.getCurrentTime());
      const d = p.getDuration();
      setDuration((prev) => (d && d !== prev ? d : prev));
    }, 250);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [playing]);

  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (ended) { p.seekTo(0, true); p.playVideo(); setEnded(false); return; }
    if (playing) p.pauseVideo(); else p.playVideo();
  }, [playing, ended]);

  const onSeek = useCallback((t: number) => {
    const p = playerRef.current;
    if (!p) return;
    p.seekTo(t, true);
    setCurrent(t);
  }, []);

  const seekBy = useCallback((delta: number) => {
    const p = playerRef.current;
    if (!p) return;
    const d = p.getDuration() || Infinity;
    const t = Math.min(Math.max(0, p.getCurrentTime() + delta), d);
    p.seekTo(t, true);
    setCurrent(t);
  }, []);

  const onRate = useCallback((r: number) => {
    playerRef.current?.setPlaybackRate(r);
    setRate(r);
  }, []);

  const onVolume = useCallback((v: number) => {
    const p = playerRef.current;
    if (!p) return;
    p.setVolume(v);
    setVolume(v);
    if (v === 0) { p.mute(); setMuted(true); }
    else if (muted) { p.unMute(); setMuted(false); }
  }, [muted]);

  const toggleMute = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (muted) { p.unMute(); setMuted(false); if (volume === 0) { p.setVolume(50); setVolume(50); } }
    else { p.mute(); setMuted(true); }
  }, [muted, volume]);

  const toggleFullscreen = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }, []);

  // На паузе контролы и так показаны (shown = controlsShown || !playing),
  // поэтому здесь только гасим таймер автоскрытия.
  useEffect(() => {
    if (!playing && hideRef.current) { clearTimeout(hideRef.current); hideRef.current = null; }
    return () => { if (hideRef.current) clearTimeout(hideRef.current); };
  }, [playing]);

  function handleActivity() {
    setControlsShown(true);
    if (hideRef.current) clearTimeout(hideRef.current);
    if (playing) hideRef.current = window.setTimeout(() => setControlsShown(false), 2600);
  }

  const effectiveVol = muted ? 0 : volume;
  const onSurfaceClick = useClickGestures({ togglePlay, seekBy, toggleFullscreen });
  const poster = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  return (
    <div
      ref={wrapperRef}
      onPointerMove={handleActivity}
      onPointerLeave={() => { if (playing) setControlsShown(false); }}
      className="relative w-full aspect-video rounded-md overflow-hidden bg-black ring-1 ring-white/10 select-none group [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:z-0 [&_iframe]:pointer-events-none"
    >
      {!started ? (
        <Facade posterUrl={poster} title={title} onPlay={() => setStarted(true)} />
      ) : (
        <>
          {/* Вуаль на паузе/в конце/при загрузке — прячет нативный UI YouTube */}
          {veiled && <Veil posterUrl={poster} />}

          {/* Слой жестов: клик — play/pause, дабл слева/справа — ∓10с, дабл в центре — фуллскрин */}
          <button
            type="button"
            onClick={onSurfaceClick}
            aria-label={playing ? 'Пауза' : 'Воспроизвести'}
            className="absolute inset-0 z-[2] cursor-pointer"
          />

          {/* Спиннер до готовности */}
          {!ready && (
            <span className="absolute left-1/2 top-1/2 z-[3] -translate-x-1/2 -translate-y-1/2 w-9 h-9 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
          )}

          {/* Центральная кнопка play на паузе/в конце */}
          {ready && !playing && (
            <button
              type="button"
              onClick={togglePlay}
              aria-label="Воспроизвести"
              className="absolute left-1/2 top-1/2 z-[3] -translate-x-1/2 -translate-y-1/2 grid place-items-center w-16 h-16 rounded-full bg-black/50 backdrop-blur-md ring-1 ring-white/30 text-white transition-transform hover:scale-105"
            >
              {ended ? <ReplayIcon /> : <PlayIcon size={26} className="translate-x-[1px]" />}
            </button>
          )}

          <ControlsBar
            shown={controlsShown || !playing}
            playing={playing}
            current={current}
            duration={duration}
            volume={effectiveVol}
            muted={muted}
            rate={rate}
            onRate={onRate}
            onTogglePlay={togglePlay}
            onSeek={onSeek}
            onVolume={onVolume}
            onToggleMute={toggleMute}
            onFullscreen={toggleFullscreen}
          />

          {failed && <YouTubeFallback posterUrl={poster} videoId={videoId} />}
        </>
      )}
    </div>
  );
}

/** Фолбэк, когда встраиваемый плеер не смог запустить ролик (onError YouTube):
 *  стабильный постер + явная ссылка «Смотреть на YouTube» вместо мигания. */
function YouTubeFallback({ posterUrl, videoId }: { posterUrl: string; videoId: string }) {
  return (
    <div className="absolute inset-0 z-[4] grid place-items-center bg-black/85 px-4 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={posterUrl} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-20" />
      <div className="relative space-y-3">
        <p className="text-sm text-white/75">Это видео нельзя воспроизвести здесь</p>
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-white text-black px-4 py-2 text-sm font-medium hover:opacity-80 transition-opacity"
        >
          Смотреть на YouTube <Icon name="external-link" size={14} />
        </a>
      </div>
    </div>
  );
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

function ControlsBar({
  shown, playing, current, duration, volume, muted, rate, onRate,
  onTogglePlay, onSeek, onVolume, onToggleMute, onFullscreen,
}: {
  shown: boolean; playing: boolean; current: number; duration: number;
  volume: number; muted: boolean;
  /** Скорость воспроизведения — кнопка появляется только если платформа её поддерживает */
  rate?: number; onRate?: (r: number) => void;
  onTogglePlay: () => void; onSeek: (t: number) => void; onVolume: (v: number) => void;
  onToggleMute: () => void; onFullscreen: () => void;
}) {
  const [rateMenuOpen, setRateMenuOpen] = useState(false);
  const pct = duration > 0 ? (current / duration) * 100 : 0;
  return (
    <motion.div
      initial={false}
      animate={{ opacity: shown ? 1 : 0, y: shown ? 0 : 8 }}
      transition={spring.snappy}
      className="absolute inset-x-0 bottom-0 z-[3] px-3 pb-2.5 pt-8 bg-gradient-to-t from-black/70 via-black/30 to-transparent"
    >
      {/* перемотка */}
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={current}
        onChange={(e) => onSeek(Number(e.target.value))}
        aria-label="Перемотка"
        className="w-full h-1 cursor-pointer accent-white"
        style={{ background: `linear-gradient(to right, rgba(255,255,255,0.85) ${pct}%, rgba(255,255,255,0.2) ${pct}%)` }}
      />

      <div className="mt-1.5 flex items-center gap-3 text-white">
        <button type="button" onClick={onTogglePlay} aria-label={playing ? 'Пауза' : 'Воспроизвести'} className="shrink-0 hover:opacity-80 transition-opacity">
          {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} className="translate-x-[1px]" />}
        </button>

        <span className="text-[11px] font-mono tabular-nums text-white/80 shrink-0">
          {formatDuration(current)} <span className="text-white/40">/ {formatDuration(duration)}</span>
        </span>

        {/* громкость */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button type="button" onClick={onToggleMute} aria-label={muted ? 'Включить звук' : 'Выключить звук'} className="hover:opacity-80 transition-opacity">
            <VolumeIcon muted={muted || volume === 0} />
          </button>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={volume}
            onChange={(e) => onVolume(Number(e.target.value))}
            aria-label="Громкость"
            className="w-16 h-1 cursor-pointer accent-white hidden sm:block"
          />
        </div>

        <div className="flex-1" />

        {/* Скорость воспроизведения */}
        {rate !== undefined && onRate && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setRateMenuOpen((o) => !o)}
              aria-label="Скорость воспроизведения"
              aria-expanded={rateMenuOpen}
              className="text-[11px] font-mono tabular-nums hover:opacity-80 transition-opacity min-w-8 text-center"
            >
              {rate}×
            </button>
            {rateMenuOpen && (
              <div className="absolute bottom-full right-0 mb-2 rounded-md bg-black/90 backdrop-blur-md ring-1 ring-white/15 py-1 min-w-16">
                {PLAYBACK_RATES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => { onRate(r); setRateMenuOpen(false); }}
                    className={`block w-full px-3 py-1 text-[11px] font-mono tabular-nums text-left transition-colors ${
                      r === rate ? 'text-white bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {r}×
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button type="button" onClick={onFullscreen} aria-label="На весь экран" className="shrink-0 hover:opacity-80 transition-opacity">
          <FullscreenIcon />
        </button>
      </div>
    </motion.div>
  );
}

function Facade({ posterUrl, title, onPlay }: { posterUrl: string | null; title?: string; onPlay: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onPlay}
      whileTap={{ scale: 0.99 }}
      transition={spring.snappy}
      aria-label={`Смотреть${title ? `: ${title}` : ' видео'}`}
      className="absolute inset-0 w-full h-full group/f"
    >
      {posterUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={posterUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-soft group-hover/f:scale-105"
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-white/15">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
        </span>
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 grid place-items-center w-16 h-16 rounded-full bg-black/45 backdrop-blur-md ring-1 ring-white/40 text-white transition-transform duration-300 ease-soft group-hover/f:scale-110">
        <PlayIcon size={26} className="translate-x-[1px]" />
      </span>
    </motion.button>
  );
}

function VkPlayer({ embed, title }: { embed: EmbedInfo; title?: string }) {
  const [started, setStarted] = useState(false);
  const [ready, setReady] = useState(false);
  const [apiFailed, setApiFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  // Вуаль скрывает нативный UI VK на паузе/в конце/до старта
  const [veiled, setVeiled] = useState(true);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100); // UI: 0..100, VK API: 0..1
  const [controlsShown, setControlsShown] = useState(true);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<VkPlayerInstance | null>(null);
  const hideRef = useRef<number | null>(null);
  const savedVolRef = useRef(100);

  // Подключаем Video Player API к iframe и опрашиваем состояние.
  // События VK не всегда стабильны, поэтому источник правды — поллинг getState().
  useEffect(() => {
    if (!started) return;
    let destroyed = false;
    let poll: number | null = null;

    loadVkPlayerApi()
      .then((VideoPlayer) => {
        if (destroyed || !iframeRef.current) return;
        const p = VideoPlayer(iframeRef.current);
        playerRef.current = p;

        poll = window.setInterval(() => {
          const player = playerRef.current;
          if (!player) return;
          try {
            const state = player.getState();
            if (state && state !== 'uninited') setReady(true);
            setPlaying(state === 'playing');
            setVeiled(state !== 'playing');
            if (state === 'ended') setEnded(true);
            else if (state === 'playing') setEnded(false);
            setCurrent(player.getCurrentTime() || 0);
            const d = player.getDuration();
            if (d) setDuration((prev) => (d !== prev ? d : prev));
            const v = player.getVolume();
            if (typeof v === 'number' && !Number.isNaN(v)) setVolume(Math.round(v * 100));
          } catch {
            // iframe мог перезагрузиться — пропускаем тик
          }
        }, 300);
      })
      .catch(() => {
        // Скрипт VK не загрузился — отдаём нативные контролы
        if (!destroyed) setApiFailed(true);
      });

    return () => {
      destroyed = true;
      if (poll) clearInterval(poll);
      try { playerRef.current?.destroy(); } catch { /* noop */ }
      playerRef.current = null;
    };
  }, [started]);

  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (ended) { p.seek(0); p.play(); setEnded(false); return; }
    if (playing) p.pause(); else p.play();
  }, [playing, ended]);

  const onSeek = useCallback((t: number) => {
    playerRef.current?.seek(t);
    setCurrent(t);
  }, []);

  const seekBy = useCallback((delta: number) => {
    const p = playerRef.current;
    if (!p) return;
    const d = p.getDuration() || Infinity;
    const t = Math.min(Math.max(0, p.getCurrentTime() + delta), d);
    p.seek(t);
    setCurrent(t);
  }, []);

  const onVolume = useCallback((v: number) => {
    playerRef.current?.setVolume(v / 100);
    setVolume(v);
    if (v > 0) savedVolRef.current = v;
  }, []);

  const toggleMute = useCallback(() => {
    if (volume === 0) onVolume(savedVolRef.current || 100);
    else { savedVolRef.current = volume; onVolume(0); }
  }, [volume, onVolume]);

  const toggleFullscreen = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }, []);

  useEffect(() => {
    if (!playing && hideRef.current) { clearTimeout(hideRef.current); hideRef.current = null; }
    return () => { if (hideRef.current) clearTimeout(hideRef.current); };
  }, [playing]);

  function handleActivity() {
    setControlsShown(true);
    if (hideRef.current) clearTimeout(hideRef.current);
    if (playing) hideRef.current = window.setTimeout(() => setControlsShown(false), 2600);
  }

  const customControls = started && !apiFailed;
  const onSurfaceClick = useClickGestures({ togglePlay, seekBy, toggleFullscreen });

  return (
    <div
      ref={wrapperRef}
      onPointerMove={customControls ? handleActivity : undefined}
      onPointerLeave={customControls ? () => { if (playing) setControlsShown(false); } : undefined}
      className={`relative w-full aspect-video rounded-md overflow-hidden bg-black ring-1 ring-white/10 select-none group ${
        customControls ? '[&_iframe]:pointer-events-none' : ''
      }`}
    >
      {!started ? (
        <Facade posterUrl={embed.thumbnailUrl} title={title} onPlay={() => setStarted(true)} />
      ) : (
        <>
          <iframe
            ref={iframeRef}
            src={`${activeEmbedUrl(embed)}&js_api=1`}
            title={title || 'Видео'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 w-full h-full z-0"
          />

          {customControls && (
            <>
              {/* Вуаль на паузе/в конце/при загрузке — прячет нативный UI VK */}
              {veiled && <Veil posterUrl={embed.thumbnailUrl} />}

              {/* Слой жестов: клик — play/pause, дабл слева/справа — ∓10с, дабл в центре — фуллскрин */}
              <button
                type="button"
                onClick={onSurfaceClick}
                aria-label={playing ? 'Пауза' : 'Воспроизвести'}
                className="absolute inset-0 z-[2] cursor-pointer"
              />

              {!ready && (
                <span className="absolute left-1/2 top-1/2 z-[3] -translate-x-1/2 -translate-y-1/2 w-9 h-9 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
              )}

              {ready && !playing && (
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label="Воспроизвести"
                  className="absolute left-1/2 top-1/2 z-[3] -translate-x-1/2 -translate-y-1/2 grid place-items-center w-16 h-16 rounded-full bg-black/50 backdrop-blur-md ring-1 ring-white/30 text-white transition-transform hover:scale-105"
                >
                  {ended ? <ReplayIcon /> : <PlayIcon size={26} className="translate-x-[1px]" />}
                </button>
              )}

              <ControlsBar
                shown={controlsShown || !playing}
                playing={playing}
                current={current}
                duration={duration}
                volume={volume}
                muted={volume === 0}
                onTogglePlay={togglePlay}
                onSeek={onSeek}
                onVolume={onVolume}
                onToggleMute={toggleMute}
                onFullscreen={toggleFullscreen}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

function ReplayIcon() {
  return <Icon name="rotate-ccw" size={24} />;
}
function VolumeIcon({ muted }: { muted: boolean }) {
  return <Icon name={muted ? 'volume-x' : 'volume-2'} size={16} className="shrink-0" />;
}
function FullscreenIcon() {
  return <Icon name="maximize" size={15} />;
}
