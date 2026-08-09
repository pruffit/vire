'use client';

import { Fragment, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Reorder, useDragControls } from 'motion/react';
import { usePlayerStore, type PlayerTrack } from '@/store/player';
import { controls } from '@/lib/player/audio-engine';
import { swapAdjacent } from '@/lib/reorder';
import { ExplicitBadge } from '@/components/explicit-badge';
import { TrackTitleText } from '@/components/track-title';
import { Icon } from '@/components/icon';
import { TrackQueueMenu } from '@/components/track-queue-menu';
import { GripIcon, WaveIcon } from './player-icons';

export function QueuePanel({ onJump }: { onJump: () => void }) {
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const currentId = usePlayerStore((s) => s.track?.id);
  const waveMode = usePlayerStore((s) => s.waveMode);

  function handleReorder(order: PlayerTrack[]) {
    const idx = currentId ? order.findIndex((t) => t.id === currentId) : 0;
    usePlayerStore.getState()._setState({ queue: order, queueIndex: Math.max(0, idx) });
  }

  function moveTrack(trackId: string, dir: -1 | 1) {
    const { queue: current } = usePlayerStore.getState();
    const next = swapAdjacent(current, trackId, dir);
    if (next !== current) handleReorder(next);
  }

  function jump(t: PlayerTrack) {
    const { queue: q, context } = usePlayerStore.getState();
    const idx = q.findIndex((x) => x.id === t.id);
    if (idx >= 0) controls.playQueue(q, { startIndex: idx, context: context ?? { source: 'direct' } });
    onJump();
  }

  return (
    <div className="w-full">
      <div className="max-h-[46vh] overflow-y-auto overscroll-contain min-h-0 -mx-1 px-1">
        <Reorder.Group
          as="div"
          axis="y"
          values={queue}
          onReorder={handleReorder}
          className="w-full space-y-1"
        >
          {queue.map((t, i) => {
            const isCurrent = t.id === currentId;
            return (
              <Fragment key={t.id}>
                {waveMode && i === queueIndex + 1 && <WaveDivider />}
                <QueueRow track={t} isCurrent={isCurrent} onJump={jump} onMove={moveTrack} />
              </Fragment>
            );
          })}
        </Reorder.Group>
      </div>
    </div>
  );
}

/** dragListener={false} + драг только с грипа — иначе touch-action:none на строке убивал тач-скролл списка. */
function QueueRow({
  track,
  isCurrent,
  onJump,
  onMove,
}: {
  track: PlayerTrack;
  isCurrent: boolean;
  onJump: (t: PlayerTrack) => void;
  onMove: (trackId: string, dir: -1 | 1) => void;
}) {
  const t = useTranslations('player');
  const dragControls = useDragControls();

  function handleGripKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      onMove(track.id, -1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onMove(track.id, 1);
    }
  }

  return (
    <Reorder.Item
      as="div"
      value={track}
      dragListener={false}
      dragControls={dragControls}
      className={`flex items-center gap-2 px-2 py-2 rounded-md select-none ${isCurrent ? 'bg-foreground/10' : 'hover:bg-foreground/5'}`}
    >
      <button
        type="button"
        onPointerDown={(e) => dragControls.start(e)}
        onKeyDown={handleGripKeyDown}
        aria-label={t('moveTrackAria', { title: track.title })}
        className="text-foreground/25 cursor-grab active:cursor-grabbing shrink-0 touch-none p-2.5 -m-1 rounded pointer-coarse:min-w-11 pointer-coarse:min-h-11 inline-flex items-center justify-center"
      >
        <GripIcon />
      </button>
      <button type="button" onClick={() => onJump(track)} className="flex-1 min-w-0 text-left">
        <span
          className="text-sm truncate flex items-center gap-1.5"
          style={isCurrent ? { color: 'var(--artist-accent)' } : undefined}
        >
          <span className="truncate">
            <TrackTitleText title={track.title} version={track.version} feat={track.feat} />
          </span>
          {track.isExplicit && <ExplicitBadge />}
          {track.localFileId && <Icon name="file" size={11} className="shrink-0 text-muted-foreground/70" />}
        </span>
        <span className="text-xs text-muted-foreground truncate block">{track.artistName}</span>
      </button>
      {isCurrent && <PlayingDot />}
      {/* Локальный файл живёт на устройстве, скачивать в офлайн-кэш нечего. */}
      {!track.localFileId && <TrackQueueMenu context={{ source: 'direct' }} track={track} />}
    </Reorder.Item>
  );
}

function WaveDivider() {
  const t = useTranslations('player');
  return (
    <div
      className="flex items-center gap-2 px-2 pt-3 pb-1 text-xs text-muted-foreground"
      aria-hidden="true"
    >
      <span style={{ color: 'var(--artist-accent)' }}>
        <WaveIcon size={14} />
      </span>
      <span>{t('nextIsWave')}</span>
      <span className="flex-1 h-px bg-foreground/8" />
    </div>
  );
}

function PlayingDot() {
  return (
    <span
      className="shrink-0 w-1.5 h-1.5 rounded-full animate-pulse"
      style={{ background: 'var(--artist-accent)' }}
      aria-hidden="true"
    />
  );
}
