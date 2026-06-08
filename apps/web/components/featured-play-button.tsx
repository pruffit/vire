'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { controls } from '@/components/player/audio-engine';
import type { PlayerTrack } from '@/store/player';

interface QLTrack {
  id: string;
  title: string;
  trackNumber: number;
  durationSec: number | null;
  status: 'PROCESSING' | 'READY' | 'BLOCKED';
}

export function FeaturedPlayButton({
  releaseId,
  artistName,
  coverUrl,
  artistSlug,
}: {
  releaseId: string;
  artistName: string;
  coverUrl: string | null;
  artistSlug: string;
}) {
  const [loading, setLoading] = useState(false);

  async function play() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/releases/${releaseId}`);
      if (!res.ok) return;
      const data: { tracks?: QLTrack[] } = await res.json() as { tracks?: QLTrack[] };
      const queue: PlayerTrack[] = (data.tracks ?? [])
        .filter((t) => t.status === 'READY')
        .map((t) => ({
          id: t.id,
          title: t.title,
          artistName,
          coverUrl,
          artistSlug,
          releaseId,
        }));
      if (queue[0]) controls.play(queue[0], queue, 0);
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.button
      type="button"
      onClick={() => { void play(); }}
      disabled={loading}
      whileTap={{ scale: 0.96 }}
      transition={spring.snappy}
      className="inline-flex items-center gap-2.5 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <PlayIcon />
      )}
      Слушать
    </motion.button>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="translate-x-[1px]">
      <polygon points="6,4 20,12 6,20" />
    </svg>
  );
}
