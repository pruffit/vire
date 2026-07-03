'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { usePlayerStore } from '@/store/player';
import { controls } from '@/components/player/audio-engine';
import { useLazyQueue } from '@/lib/player/use-play';
import { PlayIcon, PauseIcon } from '@/components/icons';
import { ExplicitBadge } from '@/components/explicit-badge';
import { formatDuration, pluralTracks } from '@/lib/format';
import { Icon } from '@/components/icon';
import { QuickLookSheet, MiniEq } from './quick-look-sheet';

interface Props {
  playlistId: string;
  title: string;
  trackCount: number;
  /** Обложка для хедера листа (первый трек / первый элемент covers). */
  cover: string | null;
  open: boolean;
  onClose: () => void;
}

/**
 * Контент peek-оверлея для плейлиста. Хром (фон, грабёр, ESC, drag)
 * предоставляет QuickLookSheet — здесь только данные и трек-лист.
 *
 * Карточки (EditorialPlaylistCard, PlaylistCard) держат open-state
 * и свой визуальный триггер, а этот компонент переиспользуется обоими.
 */
export function PlaylistPeekSheet({ playlistId, title, trackCount, cover, open, onClose }: Props) {
  const activeTrack = usePlayerStore((s) => s.track);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const { load, items: tracks } = useLazyQueue('playlist', playlistId);
  const context = { source: 'playlist' as const, sourceId: playlistId };

  useEffect(() => {
    // load() кэширует после первого успешного фетча — повторное открытие не дублирует запрос.
    if (open) void load();
  }, [open, load]);

  const isThisPlaying =
    !!activeTrack && !!(tracks ?? []).find((t) => t.id === activeTrack.id);

  async function playAll() {
    const queue = await load();
    if (queue?.[0]) controls.playQueue(queue, { context });
  }

  async function playFrom(trackId: string) {
    const queue = await load();
    if (!queue) return;
    const idx = Math.max(0, queue.findIndex((q) => q.id === trackId));
    if (queue[idx]) controls.playQueue(queue, { startIndex: idx, context });
  }

  return (
    <QuickLookSheet open={open} onClose={onClose}>
      {/* Хедер */}
      <div className="px-5 pb-3 flex items-center gap-4">
        <div className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-muted">
          {cover ? (
            <Image src={cover} alt={title} fill sizes="80px" className="object-cover" />
          ) : (
            <div className="w-full h-full grid place-items-center opacity-20">
              <Icon name="list" size={32} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-tight truncate">{title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {trackCount} {pluralTracks(trackCount)}
          </p>
        </div>
      </div>

      {/* Кнопки действий */}
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

      {/* Трек-лист */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3" data-scroll-area>
        {tracks === null && (
          <div className="py-8 grid place-items-center">
            <span className="w-6 h-6 border-2 border-white/30 border-t-transparent rounded-full animate-spin" />
          </div>
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
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors hover:bg-white/5 cursor-pointer ${isCurrent ? 'bg-white/5' : ''}`}
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
                  <span className="truncate">{t.title}</span>
                  {t.isExplicit && <ExplicitBadge />}
                </span>
                {t.durationSec != null && (
                  <span className="text-xs font-mono opacity-30 shrink-0">
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
