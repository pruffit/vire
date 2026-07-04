'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { usePlayerStore } from '@/store/player';
import { controls } from './audio-engine';
import { Controls } from './controls';
import { ArtistLink, TitleLink } from './track-links';
import { PlayerLikeButton } from '@/components/player-like-button';
import { ExplicitBadge } from '@/components/explicit-badge';
import { QueueIcon, ExpandIcon } from './player-icons';
import { formatDuration } from '@/lib/format';
import { useIsDesktopPointer } from '@/lib/is-desktop-pointer';
import { useAudioTime } from '@/lib/player/use-audio-time';
import { ratioFromX } from '@/lib/player/waveform-math';

/**
 * Мини-бар: закреплён над плеером в потоке app-shell. `ticking=false` —
 * фуллскрин открыт, живые части (прогресс/тайминги) замирают на последнем
 * значении вместо параллельного rAF-цикла со своим в фуллскрине (B4).
 */
export function MiniBar({
  onExpandCover,
  onOpenQueue,
  ticking,
}: {
  onExpandCover: () => void;
  onOpenQueue: () => void;
  ticking: boolean;
}) {
  const track = usePlayerStore((s) => s.track);
  if (!track) return null;

  return (
    <div className="relative h-full">
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
      {/* Акцентный подсвет снизу — мини-бар видимо «принадлежит» текущему треку */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to top, color-mix(in oklch, var(--artist-accent) 14%, transparent), transparent 70%)',
        }}
      />

      <div className="relative z-10 flex items-center h-full pl-3 pr-2 sm:px-4 gap-2 sm:gap-4">
        <TrackInfo onExpandCover={onExpandCover} />
        <Controls showShuffle showRepeat hideExtrasBelowSm />
        <MobileQueueButton onOpenQueue={onOpenQueue} />
        <MiniBarTrailing active={ticking} onOpenQueue={onOpenQueue} />
      </div>

      <TopProgressLine active={ticking} />
    </div>
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
          <span className="flex items-center gap-1.5 min-w-0">
            <TitleLink track={track} className="text-[11px] sm:text-sm font-medium truncate leading-tight" />
            {track.isExplicit && <ExplicitBadge />}
          </span>
          <ArtistLink track={track} className="hidden sm:block text-xs text-muted-foreground truncate" />
        </div>
        <span className="hidden sm:inline-flex shrink-0">
          <PlayerLikeButton trackId={track.id} size="sm" />
        </span>
      </div>
    </div>
  );
}

/** Компактный вход в очередь на мобилке — `MiniBarTrailing` с очередью там скрыт целиком. */
function MobileQueueButton({ onOpenQueue }: { onOpenQueue: () => void }) {
  const queueLength = usePlayerStore((s) => s.queue.length);
  if (queueLength <= 1) return null;

  return (
    <button
      type="button"
      onClick={onOpenQueue}
      aria-label={`Очередь, ${queueLength} треков`}
      className="sm:hidden shrink-0 w-10 h-10 -m-1 flex items-center justify-center opacity-60 active:opacity-100 transition-opacity"
    >
      <QueueIcon />
    </button>
  );
}

function MiniBarTrailing({ active, onOpenQueue }: { active: boolean; onOpenQueue: () => void }) {
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);
  const queueLength = usePlayerStore((s) => s.queue.length);

  // Ползунок громкости — только на десктопе (мышь/трекпад), см. is-desktop-pointer.
  const showVolume = useIsDesktopPointer();

  return (
    <div className="hidden sm:flex items-center gap-3 w-1/3 justify-end">
      <MiniCurrentTimeLabel active={active} />
      <span className="text-xs font-mono text-muted-foreground tabular-nums w-8">
        {formatDuration(duration)}
      </span>

      {queueLength > 1 && (
        <button
          type="button"
          onClick={onOpenQueue}
          aria-label={`Очередь, ${queueLength} треков`}
          className="opacity-50 hover:opacity-100 transition-opacity shrink-0"
        >
          <QueueIcon />
        </button>
      )}

      {showVolume && (
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
      )}
    </div>
  );
}

function MiniCurrentTimeLabel({ active }: { active: boolean }) {
  const currentTime = useAudioTime(4, active);
  return (
    <span className="text-xs font-mono text-muted-foreground tabular-nums w-8 text-right">
      {formatDuration(currentTime)}
    </span>
  );
}

/** Тонкая линия прогресса по верхней кромке бара — единственная перемотка на
 *  мобилке, но работает одинаково и на десктопе (клик/драг по всей ширине). */
function TopProgressLine({ active }: { active: boolean }) {
  const currentTime = useAudioTime(4, active);
  const duration = usePlayerStore((s) => s.duration);
  const ref = useRef<HTMLDivElement>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  // Утолщение по hover — только на десктопе: на таче нет реального hover, и
  // залипающий :hover после тапа выглядел бы как забытая полоска.
  const isDesktop = useIsDesktopPointer();
  const shown = scrub ?? (duration > 0 ? currentTime / duration : 0);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!duration || !ref.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrub(ratioFromX(e.clientX, ref.current.getBoundingClientRect()));
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (scrub === null || !duration || !ref.current) return;
    setScrub(ratioFromX(e.clientX, ref.current.getBoundingClientRect()));
  }
  function commit() {
    if (scrub === null || !duration) return;
    controls.seek(scrub * duration);
    setScrub(null);
  }

  const dragging = scrub !== null;

  return (
    // Зона касания 12px по высоте (видимая полоска — 2px у самой кромки).
    <div
      ref={ref}
      role="slider"
      aria-label="Перемотка"
      aria-valuenow={Math.round(shown * duration)}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={commit}
      onPointerCancel={() => setScrub(null)}
      className="absolute z-20 top-0 left-0 right-0 h-3 flex items-start touch-none cursor-pointer group"
    >
      <div
        className={`relative w-full bg-white/5 transition-[height] ${
          dragging ? 'h-[3px]' : isDesktop ? 'h-[2px] group-hover:h-[3px]' : 'h-[2px]'
        }`}
      >
        <div
          className={dragging ? 'h-full' : 'h-full transition-[width] duration-100 ease-linear'}
          style={{
            width: `${shown * 100}%`,
            background: 'var(--artist-accent, oklch(72% 0.19 145))',
            opacity: dragging ? 1 : 0.85,
          }}
        >
          {isDesktop && !dragging && (
            <span
              aria-hidden="true"
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2 h-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'var(--artist-accent, oklch(72% 0.19 145))' }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
