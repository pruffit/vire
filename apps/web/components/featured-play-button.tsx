'use client';

import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { controls } from '@/lib/player/audio-engine';
import { useLazyQueue } from '@/lib/player/use-play';
import { PlayIcon } from '@/components/icons';
import { toast } from '@/lib/toast';

export function FeaturedPlayButton({
  releaseId,
  artistName,
  coverUrl,
  artistSlug,
  accentColor,
}: {
  releaseId: string;
  artistName: string;
  coverUrl: string | null;
  artistSlug: string;
  accentColor?: string | null;
}) {
  const { load, loading } = useLazyQueue('release', releaseId, { artistName, artistSlug, coverUrl, accentColor });

  async function play() {
    const queue = await load();
    if (queue === null) {
      toast.error('Не удалось загрузить треки');
      return;
    }
    if (queue[0]) controls.playQueue(queue, { context: { source: 'release', sourceId: releaseId } });
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
        <PlayIcon className="translate-x-[1px]" />
      )}
      Слушать
    </motion.button>
  );
}
