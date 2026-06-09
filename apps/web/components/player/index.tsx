'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AnimatePresence, Reorder, motion, type PanInfo } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { usePlayerStore, type PlayerTrack } from '@/store/player';
import { controls, initAudioEngine } from './audio-engine';
import { PlayerLikeButton } from '@/components/player-like-button';
import { formatDuration } from '@/lib/format';

export function Player() {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    initAudioEngine();
  }, []);

  const track = usePlayerStore((s) => s.track);

  return (
    <>
      {/* Мини-бар: всплывает снизу при появлении трека, уезжает вниз при сбросе. */}
      <AnimatePresence>
        {track && (
          <motion.div
            key="player-bar"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={spring.smooth}
            className="relative shrink-0 h-16 border-t border-border overflow-hidden"
            style={{ '--artist-accent': track.accentColor ?? undefined } as React.CSSProperties}
          >
            {/* Ambient — размытая обложка создаёт цветовой ореол без JS-извлечения цвета */}
            {track.coverUrl && (
              <div
                aria-hidden="true"
                className="absolute inset-0 scale-110"
                style={{
                  backgroundImage: `url(${track.coverUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: 'blur(48px) saturate(2)',
                  opacity: 0.12,
                }}
              />
            )}
            <div className="absolute inset-0 bg-card/88" />
            <div className="relative z-10 flex items-center h-full px-4 gap-4">
              <TrackInfo onExpandCover={() => setExpanded(true)} />
              <Controls />
              <ProgressSection />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Фуллскрин: обложка разворачивается из мини-бара (shared layoutId). */}
      <AnimatePresence>
        {expanded && track && <FullscreenPlayer onClose={() => setExpanded(false)} />}
      </AnimatePresence>
    </>
  );
}

/** Имя артиста → страница артиста, название → страница релиза. Если слаг/releaseId
 *  не известны источнику, показываем простой текст без ссылки. */
function ArtistLink({ track, className }: { track: PlayerTrack; className?: string }) {
  if (!track.artistSlug) return <span className={className}>{track.artistName}</span>;
  return (
    <Link href={`/artists/${track.artistSlug}`} className={`${className ?? ''} hover:underline`}>
      {track.artistName}
    </Link>
  );
}

function TitleLink({ track, className }: { track: PlayerTrack; className?: string }) {
  if (!track.artistSlug || !track.releaseId) return <span className={className}>{track.title}</span>;
  return (
    <Link
      href={`/artists/${track.artistSlug}/releases/${track.releaseId}`}
      className={`${className ?? ''} hover:underline`}
    >
      {track.title}
    </Link>
  );
}

function TrackInfo({ onExpandCover }: { onExpandCover: () => void }) {
  const track = usePlayerStore((s) => s.track);
  if (!track) return null;

  return (
    <div className="flex items-center gap-3 w-1/3 min-w-0">
      <button
        onClick={onExpandCover}
        aria-label="Открыть плеер на весь экран"
        className="w-11 h-11 shrink-0 relative group"
      >
        {/* layoutId связывает эту обложку с большой в фуллскрине */}
        <motion.div
          layoutId="player-cover"
          className="absolute inset-0 rounded overflow-hidden bg-white/5"
          transition={spring.smooth}
        >
          {track.coverUrl && (
            <Image src={track.coverUrl} alt={track.title} fill sizes="44px" className="object-cover" />
          )}
        </motion.div>
        <span className="absolute inset-0 rounded bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <ExpandIcon />
        </span>
      </button>
      <div className="min-w-0 flex-1 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <TitleLink track={track} className="text-[11px] sm:text-sm font-medium truncate leading-tight block" />
          <ArtistLink track={track} className="hidden sm:block text-xs text-muted-foreground truncate" />
        </div>
        <span className="hidden sm:inline-flex shrink-0">
          <PlayerLikeButton trackId={track.id} size="sm" />
        </span>
      </div>
    </div>
  );
}

function FullscreenPlayer({ onClose }: { onClose: () => void }) {
  const track = usePlayerStore((s) => s.track);
  const queueLength = usePlayerStore((s) => s.queue.length);
  const [showQueue, setShowQueue] = useState(false);

  // Esc закрывает полноэкранный режим
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!track) return null;

  // Свайп вниз достаточно далеко/быстро — закрыть. Иначе пружина вернёт на место.
  function handleDragEnd(_e: unknown, info: PanInfo) {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      // Очередь использует свой drag-reorder + скролл — отключаем dismiss-свайп при ней.
      drag={showQueue ? false : 'y'}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.7 }}
      onDragEnd={handleDragEnd}
      className="fixed inset-0 z-50 bg-card/95 backdrop-blur-xl flex flex-col items-center overflow-y-auto px-6 py-12"
      style={{ '--artist-accent': track.accentColor ?? undefined } as React.CSSProperties}
    >
      <button
        onClick={onClose}
        aria-label="Свернуть плеер"
        className="fixed top-5 right-5 z-10 w-9 h-9 rounded-full flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
      >
        <ChevronDownIcon />
      </button>

      {/* Подсказка-«хваталка» для свайпа вниз */}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/15" />

      <div className="my-auto w-full max-w-md flex flex-col items-center gap-8">
        {/* Большая обложка — тот же layoutId, что у мини-бара */}
        <motion.div
          layoutId="player-cover"
          transition={spring.smooth}
          className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-lg overflow-hidden shadow-2xl bg-white/5 cursor-grab active:cursor-grabbing"
        >
          {track.coverUrl && (
            <Image src={track.coverUrl} alt={track.title} fill sizes="320px" className="object-cover" />
          )}
        </motion.div>

        {/* Название + артист + лайк */}
        <div className="flex items-center gap-3 min-w-0 w-full">
          <div className="flex-1 min-w-0 text-center">
            <TitleLink track={track} className="text-xl font-semibold truncate block" />
            <ArtistLink track={track} className="text-sm text-muted-foreground truncate block mt-1" />
          </div>
          <div className="shrink-0">
            <PlayerLikeButton trackId={track.id} size="md" />
          </div>
        </div>

        {/* Прогресс */}
        <div className="w-full flex items-center gap-3">
          <TimeLabel which="current" />
          <Waveform />
          <TimeLabel which="duration" />
        </div>

        {/* Управление */}
        <Controls />

        {/* Громкость + поделиться */}
        <FullscreenExtras track={track} />

        {/* Очередь */}
        {queueLength > 1 && (
          <div className="w-full">
            <button
              type="button"
              onClick={() => setShowQueue((s) => !s)}
              aria-expanded={showQueue}
              className="mx-auto flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <QueueIcon />
              {showQueue ? 'Скрыть очередь' : `Очередь · ${queueLength}`}
            </button>
            <AnimatePresence initial={false}>
              {showQueue && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={spring.smooth}
                  className="overflow-hidden"
                >
                  <QueuePanel onJump={() => setShowQueue(false)} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function QueuePanel({ onJump }: { onJump: () => void }) {
  const queue = usePlayerStore((s) => s.queue);
  const currentId = usePlayerStore((s) => s.track?.id);

  function handleReorder(order: PlayerTrack[]) {
    const idx = currentId ? order.findIndex((t) => t.id === currentId) : 0;
    usePlayerStore.getState()._setState({ queue: order, queueIndex: Math.max(0, idx) });
  }

  function jump(t: PlayerTrack) {
    const q = usePlayerStore.getState().queue;
    const idx = q.findIndex((x) => x.id === t.id);
    if (idx >= 0) controls.play(q[idx], q, idx);
    onJump();
  }

  return (
    <Reorder.Group axis="y" values={queue} onReorder={handleReorder} className="mt-3 w-full space-y-1">
      {queue.map((t) => {
        const isCurrent = t.id === currentId;
        return (
          <Reorder.Item
            key={t.id}
            value={t}
            className={`flex items-center gap-2 px-2 py-2 rounded-md select-none ${isCurrent ? 'bg-white/10' : 'hover:bg-white/5'}`}
          >
            <span className="text-white/25 cursor-grab active:cursor-grabbing shrink-0" aria-hidden="true">
              <GripIcon />
            </span>
            <button
              type="button"
              onClick={() => jump(t)}
              className="flex-1 min-w-0 text-left"
            >
              <span
                className="text-sm truncate block"
                style={isCurrent ? { color: 'var(--artist-accent)' } : undefined}
              >
                {t.title}
              </span>
              <span className="text-xs text-muted-foreground truncate block">{t.artistName}</span>
            </button>
            {isCurrent && <PlayingDot />}
          </Reorder.Item>
        );
      })}
    </Reorder.Group>
  );
}

function FullscreenExtras({ track }: { track: PlayerTrack }) {
  const volume = usePlayerStore((s) => s.volume);
  const [copied, setCopied] = useState(false);

  const shareUrl =
    track.artistSlug && track.releaseId
      ? `${window.location.origin}/artists/${track.artistSlug}/releases/${track.releaseId}/tracks/${track.id}`
      : null;

  async function share() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* нет доступа к буферу */
    }
  }

  return (
    // stopPropagation, чтобы перетаскивание ползунка громкости не закрывало плеер
    <div
      className="w-full flex items-center gap-4"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <motion.button
        onClick={() => controls.toggleMute()}
        aria-label={volume === 0 ? 'Включить звук' : 'Выключить звук'}
        whileTap={{ scale: 0.88 }}
        transition={spring.snappy}
        className="opacity-50 hover:opacity-100 transition-opacity shrink-0"
      >
        <VolumeIcon muted={volume === 0} />
      </motion.button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.02}
        value={volume}
        onChange={(e) => controls.setVolume(Number(e.target.value))}
        aria-label="Громкость"
        className="flex-1 h-1 accent-primary cursor-pointer"
      />
      {shareUrl && (
        <div className="relative shrink-0">
          <motion.button
            onClick={share}
            aria-label="Поделиться треком"
            whileTap={{ scale: 0.88 }}
            transition={spring.snappy}
            className="relative w-5 h-5 flex items-center justify-center transition-opacity"
            style={{ opacity: copied ? 1 : 0.5 }}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {copied ? (
                <motion.span
                  key="check"
                  initial={{ opacity: 0, scale: 0.4, rotate: -15 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.4 }}
                  transition={spring.snappy}
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ color: 'var(--artist-accent, oklch(72% 0.19 145))' }}
                >
                  <CheckIcon />
                </motion.span>
              ) : (
                <motion.span
                  key="share"
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.4 }}
                  transition={spring.snappy}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <ShareIcon />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
          <AnimatePresence>
            {copied && (
              <motion.span
                initial={{ opacity: 0, y: 6, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.96 }}
                transition={spring.snappy}
                className="absolute right-0 bottom-full mb-2 whitespace-nowrap rounded-md bg-foreground/90 text-background text-[11px] font-medium px-2 py-1 pointer-events-none"
              >
                Скопировано
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function TimeLabel({ which }: { which: 'current' | 'duration' }) {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  return (
    <span className="text-xs font-mono text-muted-foreground tabular-nums w-9 text-center shrink-0">
      {formatDuration(which === 'current' ? currentTime : duration)}
    </span>
  );
}

function Controls() {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isLoading = usePlayerStore((s) => s.isLoading);
  const hasAudio = usePlayerStore((s) => s.hasAudio);
  const waveMode = usePlayerStore((s) => s.waveMode);

  // Иконка плеера: загрузка / пауза / играть — выбираем ключ для морфинга.
  const iconKey = isLoading ? 'loading' : isPlaying ? 'pause' : 'play';

  return (
    <div className="flex items-center gap-5 justify-center flex-1">
      <motion.button
        onClick={() => controls.prev()}
        aria-label="Предыдущий трек"
        whileTap={{ scale: 0.92 }}
        transition={spring.snappy}
        className="opacity-50 hover:opacity-100 transition-opacity"
      >
        <SkipBackIcon />
      </motion.button>

      <motion.button
        onClick={() => controls.togglePlay()}
        disabled={!hasAudio || isLoading}
        aria-label={isPlaying ? 'Пауза' : 'Играть'}
        whileTap={hasAudio && !isLoading ? { scale: 0.92 } : undefined}
        transition={spring.snappy}
        className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-30 hover:bg-primary/90"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={iconKey}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={spring.snappy}
            className="flex items-center justify-center"
          >
            {isLoading ? (
              <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <PauseIcon />
            ) : (
              <PlayIcon />
            )}
          </motion.span>
        </AnimatePresence>
      </motion.button>

      <motion.button
        onClick={() => controls.next()}
        aria-label="Следующий трек"
        whileTap={{ scale: 0.92 }}
        transition={spring.snappy}
        className="opacity-50 hover:opacity-100 transition-opacity"
      >
        <SkipForwardIcon />
      </motion.button>

      <motion.button
        onClick={() => controls.setWaveMode(!waveMode)}
        aria-label={waveMode ? 'Режим волны включён' : 'Режим волны выключен'}
        aria-pressed={waveMode}
        whileTap={{ scale: 0.88 }}
        transition={spring.snappy}
        className="relative transition-colors"
        style={
          waveMode
            ? { color: 'var(--artist-accent, oklch(72% 0.19 145))' }
            : { opacity: 0.3 }
        }
      >
        <WaveIcon />
        <AnimatePresence>
          {waveMode && (
            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 0.22, scale: 1.9 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={spring.snappy}
              aria-hidden="true"
              className="absolute inset-0 rounded-full blur-md pointer-events-none"
              style={{ background: 'var(--artist-accent, oklch(72% 0.19 145))' }}
            />
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}

function ProgressSection() {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);

  return (
    <div className="hidden sm:flex items-center gap-2 w-1/3 justify-end">
      <span className="text-xs font-mono text-muted-foreground tabular-nums w-8 text-right">
        {formatDuration(currentTime)}
      </span>

      <Waveform />

      <span className="text-xs font-mono text-muted-foreground tabular-nums w-8">
        {formatDuration(duration)}
      </span>

      <input
        type="range"
        min={0}
        max={1}
        step={0.02}
        value={volume}
        onChange={(e) => controls.setVolume(Number(e.target.value))}
        aria-label="Громкость"
        className="w-16 h-1 accent-primary cursor-pointer hidden lg:block"
      />
    </div>
  );
}

function Waveform() {
  const peaks = usePlayerStore((s) => s.waveformPeaks);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);

  const progress = duration > 0 ? currentTime / duration : 0;

  function handleClick(e: MouseEvent<SVGSVGElement>) {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    controls.seek(((e.clientX - rect.left) / rect.width) * duration);
  }

  if (!peaks || peaks.length === 0) {
    return (
      <input
        type="range"
        min={0}
        max={duration || 100}
        value={currentTime}
        step={0.5}
        onChange={(e) => controls.seek(Number(e.target.value))}
        aria-label="Прогресс"
        className="flex-1 h-1 accent-primary cursor-pointer"
      />
    );
  }

  const BAR_COUNT = 80;
  const step = peaks.length / BAR_COUNT;
  const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
    const from = Math.floor(i * step);
    const to = Math.min(Math.ceil((i + 1) * step), peaks.length);
    const slice = peaks.slice(from, to);
    return slice.length > 0 ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
  });

  const SVG_H = 24;
  const BAR_W = 2;
  const BAR_GAP = 1;
  const SVG_W = BAR_COUNT * (BAR_W + BAR_GAP);

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      preserveAspectRatio="none"
      onClick={handleClick}
      aria-label="Прогресс"
      role="slider"
      aria-valuenow={Math.round(currentTime)}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      className="flex-1 h-6 cursor-pointer"
    >
      {bars.map((peak, i) => {
        const h = Math.max(2, peak * (SVG_H - 4));
        const x = i * (BAR_W + BAR_GAP);
        const played = i / BAR_COUNT < progress;
        return (
          <rect
            key={i}
            x={x}
            y={(SVG_H - h) / 2}
            width={BAR_W}
            height={h}
            rx={0.5}
            style={{
              fill: played ? 'var(--artist-accent, rgba(255,255,255,0.75))' : 'rgba(255,255,255,0.18)',
              transition: 'fill 0.12s linear',
            }}
          />
        );
      })}
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="5" y="3" width="4" height="18" rx="1" />
      <rect x="15" y="3" width="4" height="18" rx="1" />
    </svg>
  );
}

function SkipBackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="19,20 9,12 19,4" />
      <rect x="5" y="4" width="2" height="16" rx="1" />
    </svg>
  );
}

function SkipForwardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,4 15,12 5,20" />
      <rect x="17" y="4" width="2" height="16" rx="1" />
    </svg>
  );
}

function VolumeIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50 shrink-0">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
      {muted ? (
        <line x1="22" y1="9" x2="16" y2="15" />
      ) : (
        <>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </>
      )}
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function QueueIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="3" y1="6" x2="16" y2="6" />
      <line x1="3" y1="12" x2="16" y2="12" />
      <line x1="3" y1="18" x2="12" y2="18" />
      <polygon points="19 8 19 16 23 12" fill="currentColor" stroke="none" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" />
      <circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" />
      <circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" />
    </svg>
  );
}

function PlayingDot() {
  return (
    <span
      className="shrink-0 w-1.5 h-1.5 rounded-full animate-pulse"
      style={{ background: 'var(--artist-accent)' }}
      aria-hidden="true"
    />
  );
}

function WaveIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12 C4.5 6, 7.5 6, 10 12 C12.5 18, 15.5 18, 18 12 C20.5 6, 22 6, 22 12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
