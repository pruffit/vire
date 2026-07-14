'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { spring } from '@vire/ui/motion';
import type { PlayerTrack, PlayContext } from '@/store/player';
import { controls } from '@/lib/player/audio-engine';
import { Icon, type IconName } from '@/components/icon';
import { toast } from '@/lib/toast';

type Loader = () => Promise<PlayerTrack[] | null> | PlayerTrack[];

export async function enqueueWithToast(load: Loader, position: 'next' | 'end', context: PlayContext): Promise<void> {
  const tracks = await load();
  if (!tracks || tracks.length === 0) {
    toast.error('Не удалось загрузить треки');
    return;
  }
  const inserted = controls.enqueue(tracks, position, context);
  if (inserted === 0) toast('Уже в очереди');
  else toast(position === 'next' ? 'Будет следующим' : 'В очереди');
}

export function TrackQueueMenu({ getTracks, context, size = 'sm' }: {
  getTracks: Loader;
  context: PlayContext;
  size?: 'sm' | 'md';
}) {
  const [open, setOpen] = useState(false);
  const [dropDown, setDropDown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function pick(position: 'next' | 'end') {
    setOpen(false);
    void enqueueWithToast(getTracks, position, context);
  }

  function toggleOpen() {
    // у строк под шапкой поповеру нет места сверху — открываем вниз
    if (!open && ref.current) setDropDown(ref.current.getBoundingClientRect().top < 170);
    setOpen((o) => !o);
  }

  // хит-зона 44px при визуальном футпринте 32/36px (тач-таргет, как в wave-start-button)
  const dim = size === 'sm' ? 'w-11 h-11 -m-1.5' : 'w-11 h-11 -m-1';
  return (
    <div ref={ref} className="relative shrink-0">
      <motion.button
        type="button"
        onClick={toggleOpen}
        aria-label="Действия с очередью"
        aria-expanded={open}
        whileTap={{ scale: 0.9 }}
        transition={spring.snappy}
        className={`${dim} rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer`}
      >
        <Icon name="more-vertical" size={16} />
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: dropDown ? -6 : 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: dropDown ? -4 : 4, scale: 0.97 }}
            transition={spring.snappy}
            className={`absolute z-50 right-0 min-w-[184px] rounded-xl border border-white/12 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/40 p-1 ${
              dropDown ? 'top-full mt-2' : 'bottom-full mb-2'
            }`}
          >
            <MenuItem label="Играть следующим" icon="corner-down-right" onClick={() => pick('next')} />
            <MenuItem label="Добавить в очередь" icon="list-plus" onClick={() => pick('end')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({ label, icon, onClick }: { label: string; icon: IconName; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-foreground/85 hover:bg-white/8 transition-colors"
    >
      <span className="w-4 shrink-0 flex items-center justify-center text-foreground/30">
        <Icon name={icon} size={14} />
      </span>
      <span className="flex-1">{label}</span>
    </button>
  );
}
