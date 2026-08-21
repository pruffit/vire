'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { spring } from '@vire/ui/motion';
import { usePlayerStore, type PlayerTrack, type PlayContext } from '@/store/player';
import { controls } from '@/lib/player/audio-engine';
import { toPlayerTracks } from '@/lib/player/to-player-track';
import { usePlay, useTrackPlayState } from '@/lib/player/use-play';
import { TrackRow } from '@/components/track-row';
import { Icon } from '@/components/icon';
import { touchTargetClass } from '@/components/popover';
import { formatCount } from '@/lib/format';
import { PlayerLikeButton } from './player-like-button';
import { TrackQueueMenu } from './track-queue-menu';

export interface PlayableTrackItem {
  id: string;
  title: string;
  artistName: string;
  artistSlug: string;
  releaseId: string;
  coverUrl: string | null;
  accentColor?: string | null;
  isExplicit?: boolean;
  plays?: number;
  version?: string | null;
  feat?: string[];
}

export function PlayableTrackList({
  tracks,
  variant = 'plain',
  columns = 2,
  context,
  quickAdd = false,
}: {
  tracks: PlayableTrackItem[];
  variant?: 'plain' | 'ranked';
  columns?: 1 | 2;
  context: PlayContext;
  /** Кнопка «добавить в очередь» прямо в строке — для сценариев вроде поиска на вечеринке,
   *  где нужно быстро накидать несколько треков подряд и видеть, какие уже добавлены. */
  quickAdd?: boolean;
}) {
  const queue: PlayerTrack[] = toPlayerTracks(tracks);

  const grid = columns === 2 ? 'grid grid-cols-1 lg:grid-cols-2 lg:gap-x-8' : 'grid grid-cols-1';

  // без Stagger: motion-обёртки держат transform-слой на строках → джиттер скролла; CSS-анимация демотируется по завершении
  return (
    <div className={`${grid} animate-fade-up`}>
      {tracks.map((t, i) => (
        <Row key={t.id} track={t} queue={queue} index={i} rank={variant === 'ranked' ? i + 1 : null} context={context} quickAdd={quickAdd} />
      ))}
    </div>
  );
}

function QuickAddButton({ track, context }: { track: PlayerTrack; context: PlayContext }) {
  const t = useTranslations('track.queue');
  const inQueue = usePlayerStore((s) => s.queue.some((q) => q.id === track.id));

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!inQueue) controls.enqueue([track], 'end', context);
      }}
      disabled={inQueue}
      aria-label={inQueue ? t('alreadyQueued') : t('addToQueue')}
      title={inQueue ? t('alreadyQueued') : t('addToQueue')}
      className={`shrink-0 ${touchTargetClass('sm')} rounded-full flex items-center justify-center transition-colors ${
        inQueue
          ? 'text-primary'
          : 'text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100'
      }`}
    >
      <Icon name={inQueue ? 'check' : 'plus'} size={14} />
    </button>
  );
}

function Row({
  track, queue, index, rank, context, quickAdd,
}: {
  track: PlayableTrackItem;
  queue: PlayerTrack[];
  index: number;
  rank: number | null;
  context: PlayContext;
  quickAdd: boolean;
}) {
  const { playQueue, toggle } = usePlay();
  const { isActive, isPlaying } = useTrackPlayState(track.id);

  function handleClick() {
    if (isActive) toggle(track.id);
    else playQueue(queue, { startIndex: index, context });
  }

  return (
    <motion.div whileTap={{ scale: 0.99 }} transition={spring.snappy}>
      <TrackRow
        track={track}
        isActive={isActive}
        isPlaying={isPlaying}
        onPlay={handleClick}
        clickableRow
        className="border-b border-border/60"
        leading={rank != null && (
          <span className="w-6 shrink-0 text-center font-mono text-sm tabular-nums text-muted-foreground group-hover:text-foreground transition-colors">
            {rank}
          </span>
        )}
        trailing={
          <>
            {track.plays != null && track.plays > 0 && (
              <span className="shrink-0 text-xs font-mono tabular-nums text-muted-foreground hidden sm:block group-hover:opacity-0 transition-opacity">
                {formatCount(track.plays)}
              </span>
            )}
            <span className="shrink-0 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
              <PlayerLikeButton trackId={track.id} size="sm" />
            </span>
            {quickAdd && (
              <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
                <QuickAddButton track={queue[index]} context={context} />
              </span>
            )}
            <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
              <TrackQueueMenu getTracks={() => [queue[index]]} context={context} track={queue[index]} />
            </span>
          </>
        }
      />
    </motion.div>
  );
}
