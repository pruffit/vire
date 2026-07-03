'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { usePlayerStore, type PlayerTrack } from '@/store/player';
import { controls } from './audio-engine';
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
import { isDesktopPointer } from '@/lib/is-desktop-pointer';
import { useAudioTime } from '@/lib/player/use-audio-time';

const subscribeNoop = () => () => {};

/**
 * Фуллскрин-плеер: обложка разворачивается из мини-бара (shared layoutId
 * `player-cover`). Фон — глубокий OKLCH-градиент от акцента трека, не
 * серая card-заливка: плеер визуально «принадлежит» текущему релизу.
 */
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
        className="fixed top-5 right-5 z-10 w-9 h-9 rounded-full flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
      >
        <ChevronDownIcon />
      </button>

      {/* Подсказка-«хваталка» для свайпа вниз */}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/15" />

      <div className="my-auto w-full max-w-md flex flex-col items-center gap-8">
        <div className="relative">
          {/* Мягкое акцентное свечение за обложкой — глубина без серого. */}
          <div
            aria-hidden="true"
            className="absolute -inset-8 rounded-full blur-3xl animate-breathe pointer-events-none"
            style={{ background: 'color-mix(in oklch, var(--artist-accent, oklch(55% 0.12 260)) 55%, transparent)' }}
          />
          <motion.div
            layoutId="player-cover"
            transition={spring.smooth}
            className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-lg overflow-hidden shadow-2xl shadow-black/50 bg-white/5 cursor-grab active:cursor-grabbing"
          >
            {track.coverUrl && (
              <Image src={track.coverUrl} alt={track.title} fill sizes="320px" className="object-cover" />
            )}
          </motion.div>
        </div>

        {/* Поток (слева) + название + артист + лайк (справа) — поток зеркалит лайк */}
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

        {/* Прогресс */}
        <div className="w-full flex items-center gap-3">
          <CurrentTimeLabel />
          <PlayerWaveform />
          <DurationLabel />
        </div>

        {/* Управление: шафл слева зеркалит «поделиться» справа, поток — в строке названия */}
        <Controls showWaveMode={false} showShuffle trailing={<FullscreenShareButton track={track} />} />

        {/* Синхронизированный текст (если есть) */}
        <Lyrics key={track.id} trackId={track.id} />

        {/* Нижняя панель: громкость (десктоп) + очередь; список очереди раскрывается под ней. */}
        <div className="w-full flex flex-col items-center gap-3">
          <FullscreenExtras
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
  queueLength,
  showQueue,
  onToggleQueue,
}: {
  queueLength: number;
  showQueue: boolean;
  onToggleQueue: () => void;
}) {
  const volume = usePlayerStore((s) => s.volume);

  // Ползунок громкости — только на десктопе (мышь/трекпад). На планшетах/телефонах
  // прячем: там громкостью рулят хардварные кнопки. useSyncExternalStore: на сервере
  // true (показываем), на клиенте — реальный детект, без рассинхрона гидрации.
  const showVolume = useSyncExternalStore(subscribeNoop, isDesktopPointer, () => true);

  return (
    // stopPropagation, чтобы взаимодействие с громкостью/очередью не закрывало плеер свайпом.
    <div
      className={showVolume ? 'w-full flex items-center gap-4' : 'flex items-center gap-6'}
      onPointerDown={(e) => e.stopPropagation()}
    >
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
    </div>
  );
}

const timeLabelClass = 'text-xs font-mono text-muted-foreground tabular-nums w-9 text-center shrink-0';

// Раздельные листья: подписка на живой тик нужна только текущему времени —
// длительность меняется редко (durationchange), тикать вместе с ним незачем.
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
