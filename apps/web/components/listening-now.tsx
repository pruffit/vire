'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { usePlay } from '@/lib/player/use-play';
import { toPlayerTrack } from '@/lib/player/to-player-track';
import { PlayIcon } from '@/components/icons';

export interface ListeningNowTrack {
  id: string;
  title: string;
  artistName: string;
  artistSlug: string;
  releaseId: string;
  coverUrl: string | null;
  accentColor: string | null;
  listeners: number;
}

const POLL_MS = 30_000;

/**
 * Секция «Сейчас слушают» на главной: треки с живыми слушателями прямо сейчас.
 * Обновляется опросом /api/v1/listening-now; исчезает целиком, когда никто
 * не слушает. Клик по треку — играет его.
 */
export function ListeningNow({ initial }: { initial: ListeningNowTrack[] }) {
  const [items, setItems] = useState(initial);

  useEffect(() => {
    let alive = true;

    async function poll() {
      if (document.visibilityState !== 'visible') return;
      const res = await fetch('/api/v1/listening-now').catch(() => null);
      if (!res?.ok || !alive) return;
      const data = (await res.json()) as { tracks?: ListeningNowTrack[] };
      if (alive && Array.isArray(data.tracks)) setItems(data.tracks);
    }

    const timer = setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <AnimatePresence initial={false}>
      {items.length > 0 && (
        <motion.section
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={spring.smooth}
          className="overflow-hidden"
        >
          <div className="space-y-5">
            <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2.5">
              Сейчас слушают
              <LivePulse />
            </h2>
            <div className="grid sm:grid-cols-2 gap-1">
              <AnimatePresence initial={false}>
                {items.map((t) => (
                  <TrackRow key={t.id} track={t} />
                ))}
              </AnimatePresence>
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

function TrackRow({ track }: { track: ListeningNowTrack }) {
  const { playQueue, toggle, isCurrent } = usePlay();
  const isActive = isCurrent(track.id);

  function play() {
    if (isActive) {
      toggle(track.id);
      return;
    }
    playQueue([toPlayerTrack(track)], { context: { source: 'home' } });
  }

  return (
    // Без motion `layout`: скролл-контейнер (#main-content) — обычный div, motion
    // не знает про его scroll-offset, поэтому layout-проекция «плыла» за скроллом
    // и дёргала строку (обложку/кружки) на каждом кадре прокрутки. Enter/exit
    // по-прежнему анимируются через initial/animate/exit.
    <motion.button
      type="button"
      onClick={play}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={spring.snappy}
      whileTap={{ scale: 0.98 }}
      className="group flex items-center gap-3 p-2 -mx-2 rounded-md text-left hover:bg-accent/10 transition-colors"
    >
      <span className="relative w-10 h-10 shrink-0 rounded overflow-hidden bg-muted">
        {track.coverUrl && (
          <Image src={track.coverUrl} alt="" fill quality={60} sizes="40px" className="object-cover" />
        )}
        <span className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <PlayIcon size={12} className="text-white" />
        </span>
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block text-sm font-medium truncate ${isActive ? 'text-primary' : ''}`}>
          {track.title}
        </span>
        <span className="block text-xs text-muted-foreground truncate">{track.artistName}</span>
      </span>
      <span className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
        <LivePulse small />
        {track.listeners.toLocaleString('ru-RU')}
      </span>
    </motion.button>
  );
}

function LivePulse({ small = false }: { small?: boolean }) {
  const sz = small ? 'w-1.5 h-1.5' : 'w-2 h-2';
  return (
    <span className={`relative flex ${sz} shrink-0`} aria-hidden="true">
      <span className={`absolute inline-flex w-full h-full rounded-full opacity-60 animate-ping bg-green-400`} />
      <span className={`relative inline-flex ${sz} rounded-full bg-green-400`} />
    </span>
  );
}

