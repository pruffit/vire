'use client';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'motion/react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { PlayerTrack, PlayContext } from '@/store/player';
import { usePlay } from '@/lib/player/use-play';
import { PlayIcon, PauseIcon } from '@/components/icons';
import { ExplicitBadge } from '@/components/explicit-badge';
import { Icon } from '@/components/icon';
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
  const { playQueue, toggle, isCurrent, isPlaying } = usePlay();
  const isThisTrack = isCurrent(track.id);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 py-2 px-3 -mx-3 rounded-lg hover:bg-secondary/50 group transition-colors ${isDragging ? 'opacity-60 z-10' : ''}`}
    >
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

      <button
        onClick={() => (isThisTrack ? toggle(track.id) : playQueue(queue, { startIndex: queueIndex, context }))}
        aria-label={isThisTrack && isPlaying ? 'Пауза' : `Играть ${track.title}`}
        className="relative w-10 h-10 rounded-md overflow-hidden shrink-0 flex items-center justify-center bg-card"
      >
        {track.coverUrl
          ? <Image src={track.coverUrl} alt={track.title} fill sizes="40px" className="object-cover" />
          : <div className="w-full h-full bg-secondary" />}
        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isThisTrack ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          {isThisTrack && isPlaying ? <PauseIcon size={12} className="text-white" /> : <PlayIcon size={12} className="text-white" />}
        </div>
        {isThisTrack && isPlaying && (
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
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate flex items-center gap-1.5 ${isThisTrack ? 'text-primary' : ''}`}>
          <span className="truncate">{track.title}</span>
          {track.isExplicit && <ExplicitBadge />}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          <Link href={`/artists/${track.artistSlug}`} className="hover:text-foreground transition-colors">{track.artistName}</Link>
        </p>
      </div>

      {track.durationSec && (
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
    </div>
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
