'use client';
import Link from 'next/link';
import { motion } from 'motion/react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { PlayerTrack, PlayContext } from '@/store/player';
import { usePlay, useTrackPlayState } from '@/lib/player/use-play';
import { Icon } from '@/components/icon';
import { TrackRow } from '@/components/track-row';
import { formatDuration } from '@/lib/format';
import type { PlaylistTrackRow as TrackData } from '@vire/db';

interface Props {
  track: TrackData;
  index: number;
  queue: PlayerTrack[];
  queueIndex: number;
  context: PlayContext;
  isOwner: boolean;
  onRemove: (trackId: string) => void;
}

export function SortablePlaylistRow({ track, index, queue, queueIndex, context, isOwner, onRemove }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: track.id, disabled: !isOwner });
  const { playQueue, toggle } = usePlay();
  const { isActive: isThisTrack, isPlaying } = useTrackPlayState(track.id);

  return (
    <TrackRow
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'opacity-60 z-10' : ''}
      track={track}
      isActive={isThisTrack}
      isPlaying={isPlaying}
      onPlay={() => (isThisTrack ? toggle(track.id) : playQueue(queue, { startIndex: queueIndex, context }))}
      keepOverlayWhilePlaying
      subtitle={
        <Link href={`/artists/${track.artistSlug}`} className="hover:text-foreground transition-colors">
          {track.artistName}
        </Link>
      }
      coverExtra={isThisTrack && isPlaying && (
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
          {isOwner && (
            <button
              {...attributes} {...listeners}
              aria-label="Перетащить"
              className="touch-none cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-40 hover:!opacity-80 transition-opacity shrink-0 text-muted-foreground"
            >
              <GripIcon />
            </button>
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
          {isOwner && (
            <button
              onClick={() => onRemove(track.id)}
              aria-label="Удалить из плейлиста"
              className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive shrink-0"
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
