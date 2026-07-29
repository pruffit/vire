'use client';

import Image from 'next/image';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { usePlayerStore, type JamOverride } from '@/store/player';
import { controls } from '@/lib/player/audio-engine';
import { jamToggle, getJamTransport } from '@/lib/jam/jam-controls';
import { useJamPosition } from '@/lib/jam/use-jam-position';
import { Icon } from '@/components/icon';
import { Controls } from './controls';
import { ArtistLink, TitleLink } from './track-links';
import { PlayerLikeButton } from '@/components/player-like-button';
import { ExplicitBadge } from '@/components/explicit-badge';
import { QueueIcon, ExpandIcon, SkipBackIcon, SkipForwardIcon } from './player-icons';
import { ProgressLine } from './progress-line';
import { formatDuration } from '@/lib/format';
import { useIsDesktopPointer } from '@/lib/is-desktop-pointer';
import { useAudioTime } from '@/lib/player/use-audio-time';

/** Мини-бар. `ticking=false` (фуллскрин открыт) замораживает живые части — не крутить два rAF-цикла. */
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
  const jamOverride = usePlayerStore((s) => s.jamOverride);

  if (jamOverride) return <JamMiniBar override={jamOverride} ticking={ticking} />;
  if (!track) return null;

  return (
    <div className="relative h-full">
      {/* Размытая обложка даёт цветовой ореол без JS-извлечения цвета */}
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

/** Джем-takeover: глобальный движок остановлен (см. audio-engine guard) — полноценный транспорт уходит в зарегистрированный getJamTransport(). */
function JamMiniBar({ override, ticking }: { override: JamOverride; ticking: boolean }) {
  const { track, isPlaying, durationSec, canPrev, canNext } = override;
  // Тикает и на паузе: перемотка паузнутого джема должна двигать полоску (значение то же — React делает bail-out).
  const position = useJamPosition(ticking);

  return (
    <div className="relative h-full">
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

      <div className="relative z-10 flex items-center h-full pl-3 pr-2 sm:px-4 gap-2 sm:gap-4">
        <div className="flex items-center gap-3 w-1/3 min-w-0">
          <span className="w-11 h-11 shrink-0 relative rounded overflow-hidden bg-white/5">
            {track.coverUrl && <Image src={track.coverUrl} alt={track.title} fill sizes="44px" className="object-cover" />}
          </span>
          <div className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="text-[11px] sm:text-sm font-medium truncate leading-tight">{track.title}</span>
              <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest text-primary">
                {override.isRemote ? 'Пульт' : 'Джем'}
              </span>
            </span>
            <span className="hidden sm:block text-xs text-muted-foreground truncate">{track.artistName}</span>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-5 justify-center flex-1">
          <button
            type="button"
            onClick={() => getJamTransport()?.prev()}
            disabled={!canPrev}
            aria-label="Предыдущий трек"
            className="p-2 -m-1 opacity-50 hover:opacity-100 disabled:opacity-20 disabled:pointer-events-none transition-opacity pointer-coarse:min-w-11 pointer-coarse:min-h-11 inline-flex items-center justify-center"
          >
            <SkipBackIcon />
          </button>
          <button
            type="button"
            onClick={() => jamToggle()}
            aria-label={isPlaying ? 'Поставить джем на паузу' : 'Возобновить джем'}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-90"
          >
            <Icon name={isPlaying ? 'pause' : 'play'} size={16} />
          </button>
          <button
            type="button"
            onClick={() => getJamTransport()?.next()}
            disabled={!canNext}
            aria-label="Следующий трек"
            className="p-2 -m-1 opacity-50 hover:opacity-100 disabled:opacity-20 disabled:pointer-events-none transition-opacity pointer-coarse:min-w-11 pointer-coarse:min-h-11 inline-flex items-center justify-center"
          >
            <SkipForwardIcon />
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-3 w-1/3 justify-end">
          <span className="text-xs font-mono text-muted-foreground tabular-nums w-8 text-right">
            {formatDuration(position)}
          </span>
          <span className="text-xs font-mono text-muted-foreground tabular-nums w-8">
            {formatDuration(durationSec ?? 0)}
          </span>
        </div>
      </div>

      <ProgressLine
        position={position}
        duration={durationSec ?? 0}
        onSeek={(seconds) => getJamTransport()?.seek(seconds * 1000)}
      />
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

/** Тонкая обёртка над ProgressLine — изолирует ре-рендер на тик от остального бара (см. useAudioTime). */
function TopProgressLine({ active }: { active: boolean }) {
  const currentTime = useAudioTime(4, active);
  const duration = usePlayerStore((s) => s.duration);
  return <ProgressLine position={currentTime} duration={duration} onSeek={(t) => controls.seek(t)} />;
}
