'use client';
import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '@/components/icon';
import { TrackRow, type TrackRowTrack } from '@/components/track-row';
import { formatDuration } from '@/lib/format';
import { touchTargetCoarse } from '@/components/popover';
import { cn } from '@/lib/utils';

export interface SortableTrackRowTrack extends TrackRowTrack {
  id: string;
  durationSec?: number | null;
}

interface Props {
  track: SortableTrackRowTrack;
  index: number;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  canDrag: boolean;
  canRemove: boolean;
  onRemove?: (trackId: string) => void;
  removeLabel?: string;
  subtitle?: ReactNode;
  /** 'roomy' — крупнее строка/обложка на мобилке, drag-хендл всегда виден (без hover). */
  size?: 'default' | 'roomy';
  onMoveUp?: (trackId: string) => void;
  onMoveDown?: (trackId: string) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export function SortableTrackRow({
  track,
  index,
  isActive,
  isPlaying,
  onPlay,
  canDrag,
  canRemove,
  onRemove,
  removeLabel = 'Удалить',
  subtitle,
  size = 'default',
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: track.id, disabled: !canDrag });

  return (
    <TrackRow
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'opacity-60 z-10' : ''}
      track={track}
      isActive={isActive}
      isPlaying={isPlaying}
      onPlay={onPlay}
      size={size}
      keepOverlayWhilePlaying
      subtitle={subtitle}
      coverExtra={isActive && isPlaying && (
        <div className="absolute bottom-0.5 left-0 right-0 flex justify-center gap-px">
          {[0, 0.1, 0.2].map((d) => (
            <motion.div
              key={d}
              className="w-0.5 bg-white rounded-full"
              animate={{ height: [2, 8, 2] }}
              transition={{ repeat: Infinity, duration: 0.8, delay: d, ease: 'easeInOut' }}
            />
          ))}
        </div>
      )}
      leading={
        <>
          {canDrag && (
            <button
              {...attributes} {...listeners}
              aria-label="Перетащить"
              className={`grid place-items-center touch-none cursor-grab active:cursor-grabbing transition-opacity shrink-0 text-muted-foreground ${
                size === 'roomy'
                  ? 'w-11 h-11 -m-1.5 opacity-70 sm:w-auto sm:h-auto sm:m-0 sm:opacity-0 sm:group-hover:opacity-40 sm:hover:!opacity-80'
                  : 'opacity-0 group-hover:opacity-40 hover:!opacity-80 pointer-coarse:opacity-70 pointer-coarse:w-11 pointer-coarse:h-11 pointer-coarse:-m-1.5'
              }`}
            >
              <GripIcon />
            </button>
          )}
          {(onMoveUp || onMoveDown) && (
            <div className="hidden shrink-0 pointer-coarse:flex">
              <button
                type="button"
                onClick={() => onMoveUp?.(track.id)}
                disabled={canMoveUp === false}
                aria-label="Переместить вверх"
                className={cn(
                  'grid place-items-center rounded text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground',
                  touchTargetCoarse('sm'),
                )}
              >
                <Icon name="chevron-up" size={14} />
              </button>
              <button
                type="button"
                onClick={() => onMoveDown?.(track.id)}
                disabled={canMoveDown === false}
                aria-label="Переместить вниз"
                className={cn(
                  'grid place-items-center rounded text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground',
                  touchTargetCoarse('sm'),
                )}
              >
                <Icon name="chevron-down" size={14} />
              </button>
            </div>
          )}
          <span className="w-4 text-right text-xs font-mono text-muted-foreground/40 tabular-nums shrink-0">
            {index + 1}
          </span>
        </>
      }
      trailing={
        <>
          {typeof track.durationSec === 'number' && track.durationSec > 0 && (
            <span className="text-xs font-mono text-muted-foreground tabular-nums shrink-0">{formatDuration(track.durationSec)}</span>
          )}
          {canRemove && (
            <button
              onClick={() => onRemove?.(track.id)}
              aria-label={removeLabel}
              className={`transition-opacity rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive shrink-0 ${
                size === 'roomy'
                  ? 'w-11 h-11 -m-1.5 opacity-70 sm:m-0 sm:opacity-0 sm:w-7 sm:h-7 sm:group-hover:opacity-100'
                  : 'opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 w-7 h-7 pointer-coarse:w-11 pointer-coarse:h-11 pointer-coarse:-m-1.5'
              }`}
            >
              <Icon name="x" size={12} />
            </button>
          )}
        </>
      }
    />
  );
}

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="6" cy="4" r="1.3" /><circle cx="10" cy="4" r="1.3" />
      <circle cx="6" cy="8" r="1.3" /><circle cx="10" cy="8" r="1.3" />
      <circle cx="6" cy="12" r="1.3" /><circle cx="10" cy="12" r="1.3" />
    </svg>
  );
}
