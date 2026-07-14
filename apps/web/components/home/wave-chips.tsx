'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { cn } from '@vire/ui';
import { usePlayerStore } from '@/store/player';
import { PlayIcon } from '@/components/icons';
import { Icon } from '@/components/icon';
import { ScrollRow } from '@/components/scroll-row';
import { useWaveSeedStart } from '@/lib/use-wave-seed-start';
import { AllTagsSheet } from '@/components/home/all-tags-sheet';
import type { TagSheetSection, WaveChipItem } from '@/components/home/wave-chip-items';

/** Ряд чипов «Поток»: первый элемент открывает шит «Все теги», остальные — клик запускает волну с этим mood/genre как seed. */
export function WaveChips({ items, sections }: { items: WaveChipItem[]; sections: TagSheetSection[] }) {
  const waveSeed = usePlayerStore((s) => s.waveSeed);
  const { loading, start } = useWaveSeedStart();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <ScrollRow
        bleedClassName="-mx-1"
        className="flex gap-2 px-1"
        edgeVariant="chip"
        // шторка гасит в цвет панели «Поток», не в фон страницы — иначе тёмная полоса поверх панели
        edgeFrom="from-[color-mix(in_oklab,white_3%,var(--background))]"
      >
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-foreground/10 text-foreground text-sm font-medium hover:bg-foreground/15 transition-colors"
        >
          <Icon name="list" size={14} />
          Все теги
        </button>

        {items.map((item) => {
          const isActive =
            !!waveSeed && (item.kind === 'mood' ? waveSeed.mood === item.key : waveSeed.genre === item.key);
          const isLoading = loading === item.key;
          return (
            <motion.button
              key={`${item.kind}-${item.key}`}
              type="button"
              onClick={() => void start(item)}
              disabled={loading !== null}
              whileTap={{ scale: 0.94 }}
              transition={spring.snappy}
              aria-pressed={isActive}
              className={cn(
                // без hover-scale: transform растеризует слой, 1px-бордер даёт светлые вертикали
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

      <AllTagsSheet open={sheetOpen} onClose={() => setSheetOpen(false)} sections={sections} />
    </>
  );
}
