'use client';

import { useEffect, useRef } from 'react';
import { LyricsScroll } from '@/components/lyrics-scroll';
import { controls } from '@/components/player/audio-engine';
import { usePlayerStore, type PlayerTrack, type PlayContext } from '@/store/player';
import type { LyricLine } from '@/lib/lrc';

interface Props {
  lines: LyricLine[];
  track: PlayerTrack | null;
  queue: PlayerTrack[];
  queueIndex: number;
  trackId: string;
  context: PlayContext;
}

export function TrackLyrics({ lines, track, queue, queueIndex, trackId, context }: Props) {
  // Сравнение внутри селектора: подписка на булево, а не на меняющийся у всех id.
  const isThisTrack = usePlayerStore((s) => s.track?.id === trackId);
  const duration = usePlayerStore((s) => s.duration);
  // play() грузит асинхронно и стартует с 0:00 — синхронный seek не выживет, откладываем до готовности трека
  const pendingSeek = useRef<number | null>(null);

  useEffect(() => {
    if (pendingSeek.current == null || !isThisTrack || duration <= 0) return;
    controls.seek(Math.min(pendingSeek.current, duration - 1));
    pendingSeek.current = null;
  }, [isThisTrack, duration]);

  function onSeekTo(t: number) {
    if (!track) return;
    if (isThisTrack) {
      controls.seek(t);
    } else {
      pendingSeek.current = t;
      controls.playQueue(queue, { startIndex: queueIndex, context });
    }
  }

  return <LyricsScroll lines={lines} variant="artist" trackId={trackId} onSeekTo={onSeekTo} />;
}
