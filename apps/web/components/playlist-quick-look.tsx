'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { usePlayerStore } from '@/store/player';
import { controls } from '@/lib/player/audio-engine';
import { useLazyQueue } from '@/lib/player/use-play';
import { PlayIcon, PauseIcon } from '@/components/icons';
import { ExplicitBadge } from '@/components/explicit-badge';
import { TrackTitleText } from '@/components/track-title';
import { formatDuration, pluralTracks } from '@/lib/format';
import { Icon } from '@/components/icon';
import { toast } from '@/lib/toast';
import { PlaylistCover } from '@/components/playlist-cover';
import { QuickLookSheet, QuickLookDragHandle, MiniEq } from './quick-look-sheet';

interface Props {
  playlistId: string;
  title: string;
  trackCount: number;
  covers: string[];
  open: boolean;
  onClose: () => void;
}

/**
 * Контент peek-оверлея плейлиста; хром (фон, грабёр, ESC, drag) — QuickLookSheet.
 * open-state держат карточки-триггеры (EditorialPlaylistCard, PlaylistCard).
 */
export function PlaylistPeekSheet({ playlistId, title, trackCount, covers, open, onClose }: Props) {
  const activeTrack = usePlayerStore((s) => s.track);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const { load, loading, items: tracks } = useLazyQueue('playlist', playlistId);
  const context = { source: 'playlist' as const, sourceId: playlistId };

  useEffect(() => {
    // успех кэшируется, сбой нет — повторное открытие после ошибки перезапросит
    if (open) {
      void load().then((queue) => {
        if (queue === null) toast.error('Не удалось загрузить треки');
      });
    }
  }, [open, load]);

  const isThisPlaying =
    !!activeTrack && !!(tracks ?? []).find((t) => t.id === activeTrack.id);

  async function playAll() {
    const queue = await load();
    if (queue === null) {
      toast.error('Не удалось загрузить треки');
      return;
    }
    if (queue[0]) controls.playQueue(queue, { context });
  }

  async function playFrom(trackId: string) {
    const queue = await load();
    if (queue === null) {
      toast.error('Не удалось загрузить треки');
      return;
    }
    const idx = Math.max(0, queue.findIndex((q) => q.id === trackId));
    if (queue[idx]) controls.playQueue(queue, { startIndex: idx, context });
  }

  return (
    <QuickLookSheet open={open} onClose={onClose}>
      <QuickLookDragHandle className="px-5 pb-3 flex items-center gap-4">
        <div className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-muted">
          <PlaylistCover covers={covers} title={title} variant="mosaic" sizes="80px" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-tight truncate">{title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {trackCount} {pluralTracks(trackCount)}
          </p>
        </div>
      </QuickLookDragHandle>

      <div className="px-5 pb-3 flex items-center gap-3">
        <motion.button
          type="button"
          onClick={() => { if (isThisPlaying) controls.togglePlay(); else void playAll(); }}
          whileTap={{ scale: 0.96 }}
          transition={spring.snappy}
          disabled={!tracks || tracks.length === 0}
          className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
        >
          {isThisPlaying && isPlaying ? (
            <PauseIcon size={13} />
          ) : (
            <PlayIcon size={15} className="translate-x-[1px]" />
          )}
          {isThisPlaying ? (isPlaying ? 'Пауза' : 'Продолжить') : 'Слушать'}
        </motion.button>
        <Link
          href={`/playlists/${playlistId}`}
          onClick={onClose}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          К плейлисту <Icon name="arrow-right" size={14} />
        </Link>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 pb-3" data-scroll-area>
        {tracks === null && loading && (
          <div className="py-8 grid place-items-center">
            <span className="w-6 h-6 border-2 border-foreground/30 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {tracks === null && !loading && (
          <p className="py-6 text-center text-sm text-muted-foreground">Не удалось загрузить треки.</p>
        )}
        {tracks && tracks.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Плейлист пуст.</p>
        )}
        {tracks &&
          tracks.map((t, i) => {
            const isCurrent = activeTrack?.id === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  isCurrent ? controls.togglePlay() : void playFrom(t.id)
                }
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors hover:bg-foreground/5 cursor-pointer ${isCurrent ? 'bg-foreground/5' : ''}`}
              >
                <span className="w-5 text-right text-xs font-mono opacity-30 shrink-0">
                  {isCurrent ? <MiniEq animate={isPlaying} /> : i + 1}
                </span>
                <span
                  className="flex-1 truncate text-sm flex items-center gap-1.5"
                  style={
                    isCurrent
                      ? { color: 'var(--artist-accent, hsl(200 80% 65%))' }
                      : undefined
                  }
                >
                  <span className="truncate">
                    <TrackTitleText title={t.title} version={t.version} feat={t.feat} />
                  </span>
                  {t.isExplicit && <ExplicitBadge />}
                </span>
                {t.durationSec != null && (
                  <span className="text-xs readout opacity-30 shrink-0">
                    {formatDuration(t.durationSec)}
                  </span>
                )}
              </button>
            );
          })}
      </div>
    </QuickLookSheet>
  );
}
