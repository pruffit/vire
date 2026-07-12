'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { usePlayerStore, type PlayerTrack } from '@/store/player';
import { controls } from '@/lib/player/audio-engine';
import { Controls, WaveModeButton } from './controls';
import { ArtistLink, TitleLink } from './track-links';
import { PlayerLikeButton } from '@/components/player-like-button';
import { ExplicitBadge } from '@/components/explicit-badge';
import { TrackShare } from '@/components/track-share';
import { Lyrics } from './lyrics';
import { WaveformScrubber } from './waveform-scrubber';
import { QueuePanel } from './queue-panel';
import { ChevronDownIcon, QueueIcon, VolumeIcon } from './player-icons';
import { formatDuration } from '@/lib/format';
import { useIsDesktopPointer } from '@/lib/is-desktop-pointer';
import { useAudioTime } from '@/lib/player/use-audio-time';

/** Фуллскрин-плеер: обложка разворачивается из мини-бара (shared layoutId `player-cover`). */
export function FullscreenPlayer({
  onClose,
  initialShowQueue = false,
}: {
  onClose: () => void;
  initialShowQueue?: boolean;
}) {
  const track = usePlayerStore((s) => s.track);
  const queueLength = usePlayerStore((s) => s.queue.length);
  const [showQueue, setShowQueue] = useState(initialShowQueue);
  const dragControls = useDragControls();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!track) return null;

  function handleDragEnd(_e: unknown, info: PanInfo) {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      drag="y"
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.7 }}
      onDragEnd={handleDragEnd}
      className="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto px-6 py-12"
      style={
        {
          '--artist-accent': track.accentColor ?? undefined,
          background:
            'radial-gradient(120% 65% at 50% -8%, color-mix(in oklch, var(--artist-accent, oklch(55% 0.12 260)) 34%, var(--background)) 0%, var(--background) 62%),' +
            'radial-gradient(90% 55% at 50% 108%, color-mix(in oklch, var(--artist-accent, oklch(55% 0.12 260)) 16%, transparent) 0%, transparent 70%),' +
            'var(--background)',
        } as React.CSSProperties
      }
    >
      <button
        onClick={onClose}
        aria-label="Свернуть плеер"
        className="fixed top-5 right-5 z-20 w-9 h-9 rounded-full flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
      >
        <ChevronDownIcon />
      </button>

      {/* Зона свайпа-закрытия; шеврон выше по z-index — тап по нему не стартует drag */}
      <div
        onPointerDown={(e) => dragControls.start(e)}
        className="fixed top-0 left-0 right-0 h-10 z-10 flex items-start justify-center pt-3 touch-none cursor-grab active:cursor-grabbing"
      >
        <span className="w-12 h-1 rounded-full bg-white/20" />
      </div>

      <div className="my-auto w-full max-w-md flex flex-col items-center gap-8">
        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute -inset-8 rounded-full blur-3xl animate-breathe pointer-events-none"
            style={{ background: 'color-mix(in oklch, var(--artist-accent, oklch(55% 0.12 260)) 55%, transparent)' }}
          />
          <motion.div
            layoutId="player-cover"
            transition={spring.smooth}
            onPointerDown={(e) => dragControls.start(e)}
            className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-lg overflow-hidden shadow-2xl shadow-black/50 bg-white/5 cursor-grab active:cursor-grabbing touch-none"
          >
            {track.coverUrl && (
              <Image src={track.coverUrl} alt={track.title} fill sizes="320px" className="object-cover" />
            )}
          </motion.div>
        </div>

        <div className="flex items-center gap-3 min-w-0 w-full">
          <div className="shrink-0">
            <WaveModeButton />
          </div>
          <div className="flex-1 min-w-0 text-center">
            <span className="flex items-center justify-center gap-2 min-w-0">
              <TitleLink track={track} onClick={onClose} className="text-xl font-semibold truncate" />
              {track.isExplicit && <ExplicitBadge />}
            </span>
            <ArtistLink track={track} onClick={onClose} className="text-sm text-muted-foreground truncate block mt-1" />
          </div>
          <div className="shrink-0">
            <PlayerLikeButton trackId={track.id} size="md" />
          </div>
        </div>

        <div className="w-full flex items-center gap-3">
          <CurrentTimeLabel />
          <PlayerWaveform />
          <DurationLabel />
        </div>

        <Controls showWaveMode={false} showShuffle showRepeat />

        <Lyrics key={track.id} trackId={track.id} />

        <div className="w-full flex flex-col items-center gap-3">
          <FullscreenExtras
            track={track}
            queueLength={queueLength}
            showQueue={showQueue}
            onToggleQueue={() => setShowQueue((s) => !s)}
          />
          <AnimatePresence initial={false}>
            {showQueue && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={spring.smooth}
                className="w-full overflow-hidden"
              >
                <QueuePanel onJump={() => setShowQueue(false)} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function FullscreenShareButton({ track }: { track: PlayerTrack }) {
  const currentTime = useAudioTime();
  if (!track.artistSlug || !track.releaseId) return null;
  const trackUrl = `${window.location.origin}/artists/${track.artistSlug}/releases/${track.releaseId}/tracks/${track.id}`;
  return <TrackShare trackUrl={trackUrl} currentTime={currentTime} align="right" />;
}

function FullscreenExtras({
  track,
  queueLength,
  showQueue,
  onToggleQueue,
}: {
  track: PlayerTrack;
  queueLength: number;
  showQueue: boolean;
  onToggleQueue: () => void;
}) {
  const volume = usePlayerStore((s) => s.volume);

  const showVolume = useIsDesktopPointer();

  return (
    <div className={showVolume ? 'w-full flex items-center gap-4' : 'flex items-center gap-6'}>
      {showVolume && (
        <>
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
        </>
      )}
      {queueLength > 1 && (
        <button
          type="button"
          onClick={onToggleQueue}
          aria-expanded={showQueue}
          className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <QueueIcon />
          {showQueue ? 'Скрыть очередь' : `Очередь · ${queueLength}`}
        </button>
      )}
      <FullscreenShareButton track={track} />
    </div>
  );
}

const timeLabelClass = 'text-xs font-mono text-muted-foreground tabular-nums w-9 text-center shrink-0';

// Раздельные листья — живой тик нужен только текущему времени, не длительности.
function CurrentTimeLabel() {
  const currentTime = useAudioTime();
  return <span className={timeLabelClass}>{formatDuration(currentTime)}</span>;
}

function DurationLabel() {
  const duration = usePlayerStore((s) => s.duration);
  return <span className={timeLabelClass}>{formatDuration(duration)}</span>;
}

/** Обёртка над общим скраббером: подставляет пики/длительность/seek из стора плеера. */
function PlayerWaveform() {
  const peaks = usePlayerStore((s) => s.waveformPeaks);
  const duration = usePlayerStore((s) => s.duration);

  return (
    <WaveformScrubber
      peaks={peaks}
      duration={duration}
      onSeek={controls.seek}
      ariaLabel="Перемотка"
      className="flex-1 h-9"
    />
  );
}
