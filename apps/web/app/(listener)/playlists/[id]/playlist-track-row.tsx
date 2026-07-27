'use client';
import Link from 'next/link';
import { SortableTrackRow } from '@/components/sortable-track-row';
import type { PlayerTrack, PlayContext } from '@/store/player';
import { usePlay, useTrackPlayState } from '@/lib/player/use-play';
import type { PlaylistTrackRow as TrackData } from '@vire/db';

interface Props {
  track: TrackData;
  index: number;
  queue: PlayerTrack[];
  queueIndex: number;
  context: PlayContext;
  isOwner: boolean;
  onRemove: (trackId: string) => void;
  onMove?: (trackId: string, dir: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export function SortablePlaylistRow({ track, index, queue, queueIndex, context, isOwner, onRemove, onMove, canMoveUp, canMoveDown }: Props) {
  const { playQueue, toggle } = usePlay();
  const { isActive: isThisTrack, isPlaying } = useTrackPlayState(track.id);

  return (
    <SortableTrackRow
      track={track}
      index={index}
      isActive={isThisTrack}
      isPlaying={isPlaying}
      onPlay={() => (isThisTrack ? toggle(track.id) : playQueue(queue, { startIndex: queueIndex, context }))}
      canDrag={isOwner}
      canRemove={isOwner}
      onRemove={onRemove}
      removeLabel="Удалить из плейлиста"
      onMoveUp={onMove ? () => onMove(track.id, -1) : undefined}
      onMoveDown={onMove ? () => onMove(track.id, 1) : undefined}
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
      subtitle={
        <Link href={`/artists/${track.artistSlug}`} className="hover:text-foreground transition-colors">
          {track.artistName}
        </Link>
      }
    />
  );
}
