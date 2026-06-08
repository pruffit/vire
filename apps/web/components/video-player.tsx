'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { activeEmbedUrl, type EmbedInfo } from '@/lib/embed';
import { loadYouTubeApi, YT_STATE, type YTPlayer } from '@/lib/youtube-api';
import { formatDuration } from '@/lib/format';

/**
 * Видео-плеер под стиль сайта. Для YouTube — полностью свои контролы через
 * IFrame Player API (нативные скрыты: play/pause, перемотка, громкость,
 * фуллскрин). Для VK — фасад с нативным плеером (полное кастом-управление VK
 * требует app-credentials, пока отдаём нативные контролы).
 */
export function VideoPlayer({ embed, title }: { embed: EmbedInfo; title?: string }) {
  if (embed.platform === 'youtube') return <YouTubePlayer videoId={embed.id} title={title} />;
  return <VkPlayer embed={embed} title={title} />;
}

function YouTubePlayer({ videoId, title }: { videoId: string; title?: string }) {
  const [started, setStarted] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);
  const [controlsShown, setControlsShown] = useState(true);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const pollRef = useRef<number | null>(null);
  const hideRef = useRef<number | null>(null);

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
            setPlaying(e.data === YT_STATE.PLAYING);
            if (e.data === YT_STATE.ENDED) setEnded(true);
            else if (e.data === YT_STATE.PLAYING) setEnded(false);
            const d = e.target.getDuration();
            setDuration((prev) => (d && d !== prev ? d : prev));
          },
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

  return (
    <div
      ref={wrapperRef}
      onPointerMove={handleActivity}
      onPointerLeave={() => { if (playing) setControlsShown(false); }}
      className="relative w-full aspect-video rounded-md overflow-hidden bg-black ring-1 ring-white/10 select-none group [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:z-0 [&_iframe]:pointer-events-none"
    >
      {!started ? (
        <Facade videoId={videoId} title={title} onPlay={() => setStarted(true)} />
      ) : (
        <>
          {/* Слой клика по видео — тоггл play/pause */}
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? 'Пауза' : 'Воспроизвести'}
            className="absolute inset-0 z-[1] cursor-pointer"
          />

          {/* Спиннер до готовности */}
          {!ready && (
            <span className="absolute left-1/2 top-1/2 z-[2] -translate-x-1/2 -translate-y-1/2 w-9 h-9 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
          )}

          {/* Центральная кнопка play на паузе/в конце */}
          {ready && !playing && (
            <button
              type="button"
              onClick={togglePlay}
              aria-label="Воспроизвести"
              className="absolute left-1/2 top-1/2 z-[2] -translate-x-1/2 -translate-y-1/2 grid place-items-center w-16 h-16 rounded-full bg-black/50 backdrop-blur-md ring-1 ring-white/30 text-white transition-transform hover:scale-105"
            >
              {ended ? <ReplayIcon /> : <PlayIcon size={26} />}
            </button>
          )}

          <ControlsBar
            shown={controlsShown || !playing}
            playing={playing}
            current={current}
            duration={duration}
            volume={effectiveVol}
            muted={muted}
            onTogglePlay={togglePlay}
            onSeek={onSeek}
            onVolume={onVolume}
            onToggleMute={toggleMute}
            onFullscreen={toggleFullscreen}
          />
        </>
      )}
    </div>
  );
}

function ControlsBar({
  shown, playing, current, duration, volume, muted,
  onTogglePlay, onSeek, onVolume, onToggleMute, onFullscreen,
}: {
  shown: boolean; playing: boolean; current: number; duration: number;
  volume: number; muted: boolean;
  onTogglePlay: () => void; onSeek: (t: number) => void; onVolume: (v: number) => void;
  onToggleMute: () => void; onFullscreen: () => void;
}) {
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
          {playing ? <PauseIcon /> : <PlayIcon size={16} />}
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

        <button type="button" onClick={onFullscreen} aria-label="На весь экран" className="shrink-0 hover:opacity-80 transition-opacity">
          <FullscreenIcon />
        </button>
      </div>
    </motion.div>
  );
}

function Facade({ videoId, title, onPlay }: { videoId: string; title?: string; onPlay: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onPlay}
      whileTap={{ scale: 0.99 }}
      transition={spring.snappy}
      aria-label={`Смотреть${title ? `: ${title}` : ' видео'}`}
      className="absolute inset-0 w-full h-full group/f"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
        alt=""
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-soft group-hover/f:scale-105"
      />
      <span className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 grid place-items-center w-16 h-16 rounded-full bg-black/45 backdrop-blur-md ring-1 ring-white/40 text-white transition-transform duration-300 ease-soft group-hover/f:scale-110">
        <PlayIcon size={26} />
      </span>
    </motion.button>
  );
}

function VkPlayer({ embed, title }: { embed: EmbedInfo; title?: string }) {
  const [active, setActive] = useState(false);
  return (
    <div className="relative w-full aspect-video rounded-md overflow-hidden bg-white/5 ring-1 ring-white/10 group">
      {active ? (
        <iframe
          src={activeEmbedUrl(embed)}
          title={title || 'Видео'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      ) : (
        <motion.button
          type="button"
          onClick={() => setActive(true)}
          whileTap={{ scale: 0.99 }}
          transition={spring.snappy}
          aria-label={`Смотреть${title ? `: ${title}` : ' видео'}`}
          className="absolute inset-0 w-full h-full grid place-items-center"
        >
          <span className="absolute inset-0 grid place-items-center text-white/15">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </span>
          <span className="relative grid place-items-center w-16 h-16 rounded-full bg-black/45 backdrop-blur-md ring-1 ring-white/30 text-white transition-transform group-hover:scale-110">
            <PlayIcon size={26} />
          </span>
        </motion.button>
      )}
    </div>
  );
}

function PlayIcon({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="translate-x-[1px]"><polygon points="6,4 20,12 6,20" /></svg>;
}
function PauseIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>;
}
function ReplayIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>;
}
function VolumeIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
      {muted ? <line x1="22" y1="9" x2="16" y2="15" /> : <><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></>}
    </svg>
  );
}
function FullscreenIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" /></svg>;
}
