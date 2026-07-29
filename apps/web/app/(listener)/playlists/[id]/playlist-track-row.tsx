'use client';
import Link from 'next/link';
import { SortableTrackRow } from '@/components/sortable-track-row';
import { ChatAvatar } from '@/components/chat/chat-avatar';
import type { PlayerTrack, PlayContext } from '@/store/player';
import { usePlay, useTrackPlayState } from '@/lib/player/use-play';
import type { PlaylistTrackRow as TrackData } from '@vire/db';

interface Props {
  track: TrackData;
  index: number;
  queue: PlayerTrack[];
  queueIndex: number;
  context: PlayContext;
  canDrag: boolean;
  canRemove: boolean;
  showAddedBy: boolean;
  onRemove: (trackId: string) => void;
}

export function SortablePlaylistRow({ track, index, queue, queueIndex, context, canDrag, canRemove, showAddedBy, onRemove }: Props) {
  const { playQueue, toggle } = usePlay();
  const { isActive: isThisTrack, isPlaying } = useTrackPlayState(track.id);

  return (
    <SortableTrackRow
      track={track}
      index={index}
      isActive={isThisTrack}
      isPlaying={isPlaying}
      onPlay={() => (isThisTrack ? toggle(track.id) : playQueue(queue, { startIndex: queueIndex, context }))}
      canDrag={canDrag}
      canRemove={canRemove}
      onRemove={onRemove}
      removeLabel="Удалить из плейлиста"
      avatar={showAddedBy && track.addedBy && (
        <span title={track.addedBy.name ?? 'Слушатель'}>
          <ChatAvatar name={track.addedBy.name} image={track.addedBy.image} size={20} />
        </span>
      )}
      subtitle={
        <Link href={`/artists/${track.artistSlug}`} className="hover:text-foreground transition-colors">
          {track.artistName}
        </Link>
      }
    />
  );
}
