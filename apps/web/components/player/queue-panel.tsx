'use client';

import { Fragment } from 'react';
import { Reorder, useDragControls } from 'motion/react';
import { usePlayerStore, type PlayerTrack } from '@/store/player';
import { controls } from './audio-engine';
import { ExplicitBadge } from '@/components/explicit-badge';
import { TrackTitleText } from '@/components/track-title';
import { GripIcon, WaveIcon } from './player-icons';

/**
 * Панель «Дальше»: очередь с текущим треком, drag-to-reorder, переход по клику.
 * Скроллится сама (родитель даёт `min-h-0`) — список может быть длиннее экрана
 * (буфер волны), но панель никогда не разворачивает скролл на всю страницу.
 * В режиме волны, после исходно запущенной очереди, разделитель отмечает
 * подобранные волной треки — точного признака «этот трек добавлен волной» у
 * буфера нет, секция честнее поштучных бейджей.
 */
export function QueuePanel({ onJump }: { onJump: () => void }) {
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const currentId = usePlayerStore((s) => s.track?.id);
  const waveMode = usePlayerStore((s) => s.waveMode);

  function handleReorder(order: PlayerTrack[]) {
    const idx = currentId ? order.findIndex((t) => t.id === currentId) : 0;
    usePlayerStore.getState()._setState({ queue: order, queueIndex: Math.max(0, idx) });
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
              <QueueRow track={t} isCurrent={isCurrent} onJump={jump} />
            </Fragment>
          );
        })}
      </Reorder.Group>
    </div>
  );
}

/**
 * Строка очереди — свой `useDragControls` на элемент: `dragListener={false}`
 * снимает touch-action:none со всей строки (иначе список нельзя было
 * проскроллить на телефоне — тач сразу становился drag-жестом), драг стартует
 * только с ручки-грипа через `onPointerDown` → `dragControls.start`.
 */
function QueueRow({
  track: t,
  isCurrent,
  onJump,
}: {
  track: PlayerTrack;
  isCurrent: boolean;
  onJump: (t: PlayerTrack) => void;
}) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      as="div"
      value={t}
      dragListener={false}
      dragControls={dragControls}
      className={`flex items-center gap-2 px-2 py-2 rounded-md select-none ${isCurrent ? 'bg-white/10' : 'hover:bg-white/5'}`}
    >
      <span
        onPointerDown={(e) => dragControls.start(e)}
        className="text-white/25 cursor-grab active:cursor-grabbing shrink-0 touch-none p-2.5 -m-1"
        aria-hidden="true"
      >
        <GripIcon />
      </span>
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
