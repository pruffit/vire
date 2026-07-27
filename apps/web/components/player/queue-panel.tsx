'use client';

import { Fragment, type KeyboardEvent } from 'react';
import { Reorder, useDragControls } from 'motion/react';
import { usePlayerStore, type PlayerTrack } from '@/store/player';
import { controls } from '@/lib/player/audio-engine';
import { swapAdjacent } from '@/lib/reorder';
import { cn } from '@/lib/utils';
import { ExplicitBadge } from '@/components/explicit-badge';
import { TrackTitleText } from '@/components/track-title';
import { Icon } from '@/components/icon';
import { touchTargetCoarse } from '@/components/popover';
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
    <div className="w-full max-h-[46vh] overflow-y-auto overscroll-contain min-h-0 -mx-1 px-1">
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
              <QueueRow
                track={t}
                isCurrent={isCurrent}
                onJump={jump}
                onMove={moveTrack}
                canMoveUp={i > 0}
                canMoveDown={i < queue.length - 1}
              />
            </Fragment>
          );
        })}
      </Reorder.Group>
    </div>
  );
}

/** dragListener={false} + драг только с грипа — иначе touch-action:none на строке убивал тач-скролл списка. */
function QueueRow({
  track: t,
  isCurrent,
  onJump,
  onMove,
  canMoveUp,
  canMoveDown,
}: {
  track: PlayerTrack;
  isCurrent: boolean;
  onJump: (t: PlayerTrack) => void;
  onMove: (trackId: string, dir: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const dragControls = useDragControls();

  function handleGripKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      onMove(t.id, -1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onMove(t.id, 1);
    }
  }

  return (
    <Reorder.Item
      as="div"
      value={t}
      dragListener={false}
      dragControls={dragControls}
      className={`flex items-center gap-2 px-2 py-2 rounded-md select-none ${isCurrent ? 'bg-white/10' : 'hover:bg-white/5'}`}
    >
      <button
        type="button"
        onPointerDown={(e) => dragControls.start(e)}
        onKeyDown={handleGripKeyDown}
        aria-label={`Переместить «${t.title}»: стрелки вверх/вниз`}
        className="text-white/25 cursor-grab active:cursor-grabbing shrink-0 touch-none p-2.5 -m-1 rounded pointer-coarse:min-w-11 pointer-coarse:min-h-11 inline-flex items-center justify-center"
      >
        <GripIcon />
      </button>
      <div className="hidden shrink-0 pointer-coarse:flex">
        <button
          type="button"
          onClick={() => onMove(t.id, -1)}
          disabled={!canMoveUp}
          aria-label="Переместить вверх"
          className={cn(
            'grid place-items-center rounded text-white/25 transition-colors hover:text-white/60 disabled:opacity-30 disabled:hover:text-white/25',
            touchTargetCoarse('sm'),
          )}
        >
          <Icon name="chevron-up" size={14} />
        </button>
        <button
          type="button"
          onClick={() => onMove(t.id, 1)}
          disabled={!canMoveDown}
          aria-label="Переместить вниз"
          className={cn(
            'grid place-items-center rounded text-white/25 transition-colors hover:text-white/60 disabled:opacity-30 disabled:hover:text-white/25',
            touchTargetCoarse('sm'),
          )}
        >
          <Icon name="chevron-down" size={14} />
        </button>
      </div>
      <button type="button" onClick={() => onJump(t)} className="flex-1 min-w-0 text-left">
        <span
          className="text-sm truncate flex items-center gap-1.5"
          style={isCurrent ? { color: 'var(--artist-accent)' } : undefined}
        >
          <span className="truncate">
            <TrackTitleText title={t.title} version={t.version} feat={t.feat} />
          </span>
          {t.isExplicit && <ExplicitBadge />}
        </span>
        <span className="text-xs text-muted-foreground truncate block">{t.artistName}</span>
      </button>
      {isCurrent && <PlayingDot />}
    </Reorder.Item>
  );
}

function WaveDivider() {
  return (
    <div
      className="flex items-center gap-2 px-2 pt-3 pb-1 text-xs text-muted-foreground"
      aria-hidden="true"
    >
      <span style={{ color: 'var(--artist-accent)' }}>
        <WaveIcon size={14} />
      </span>
      <span>Дальше — Волна</span>
      <span className="flex-1 h-px bg-white/8" />
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
