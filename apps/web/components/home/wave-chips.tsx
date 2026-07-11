'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { cn } from '@vire/ui';
import { usePlayerStore } from '@/store/player';
import { controls } from '@/components/player/audio-engine';
import { PlayIcon } from '@/components/icons';
import { ScrollRow } from '@/components/scroll-row';
import { toast } from '@/components/toast';
import type { WaveChipItem } from '@/components/home/wave-chip-items';

const ERROR_TEXT: Record<WaveChipItem['kind'], string> = {
  mood: 'Не удалось запустить поток по настроению',
  genre: 'Не удалось запустить поток по жанру',
};

/** Подписанный ряд чипов волны — используется и для настроений, и для жанров. */
export function WaveChipRow({ title, items }: { title: string; items: WaveChipItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{title}</p>
      <WaveChips items={items} />
    </div>
  );
}

/** Ряд чипов: клик по чипу запускает волну с этим mood/genre как seed. */
export function WaveChips({ items }: { items: WaveChipItem[] }) {
  const waveSeed = usePlayerStore((s) => s.waveSeed);
  const [loading, setLoading] = useState<string | null>(null);

  async function start(item: WaveChipItem) {
    if (loading) return;
    setLoading(item.key);
    try {
      const seed = item.kind === 'mood' ? { mood: item.key } : { genre: item.key };
      const started = await controls.startWave(seed);
      if (!started) toast.error(ERROR_TEXT[item.kind]);
    } finally {
      setLoading(null);
    }
  }

  return (
    <ScrollRow
      bleedClassName="-mx-1"
      className="flex gap-2 px-1"
      edgeVariant="chip"
      // Шторка гасит в цвет панели «Поток» (flow-block: bg-white/[0.03] на фоне),
      // а не в фон страницы — иначе тёмная полоса поверх серой панели.
      edgeFrom="from-[color-mix(in_oklab,white_3%,var(--background))]"
    >

      {items.map((item) => {
        const isActive =
          !!waveSeed && (item.kind === 'mood' ? waveSeed.mood === item.key : waveSeed.genre === item.key);
        const isLoading = loading === item.key;
        return (
          <motion.button
            key={`${item.kind}-${item.key}`}
            type="button"
            onClick={() => start(item)}
            disabled={loading !== null}
            whileTap={{ scale: 0.94 }}
            transition={spring.snappy}
            aria-pressed={isActive}
            className={cn(
              // hover-scale здесь запрещён: transform растеризует слой и 1px-бордер
              // пилюли даёт светлые вертикали на торцах — подсвечиваем цветом
              'shrink-0 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-sm transition-colors disabled:opacity-50',
              isActive
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-foreground/5',
            )}
          >
            {isLoading ? (
              <span
                className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"
                aria-hidden="true"
              />
            ) : (
              <PlayIcon size={9} className={isActive ? 'opacity-80' : 'opacity-50'} />
            )}
            {item.label}
          </motion.button>
        );
      })}
    </ScrollRow>
  );
}
