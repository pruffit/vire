'use client';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { SortableTrackRow } from '@/components/sortable-track-row';
import { TrackQueueMenu } from '@/components/track-queue-menu';
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
  const t = useTranslations('playlist');
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
      removeLabel={t('track.removeLabel')}
      actions={<TrackQueueMenu context={context} track={queue[queueIndex]} />}
      avatar={showAddedBy && track.addedBy && (
        <span title={track.addedBy.name ?? t('defaultListenerName')}>
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
