'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import type { PlayerTrack, PlayContext } from '@/store/player';
import { controls } from '@/lib/player/audio-engine';
import { Icon } from '@/components/icon';
import { toast } from '@/lib/toast';
import { Popover, PopoverItem, touchTargetClass } from '@/components/popover';

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

export function TrackQueueMenu({ getTracks, context, size = 'sm', drop = 'auto' }: {
  getTracks: Loader;
  context: PlayContext;
  size?: 'sm' | 'md';
  /** 'down' — внутри overflow-hidden контейнеров (peek-шит), где раскрытие вверх клипается. */
  drop?: 'auto' | 'down';
}) {
  const [open, setOpen] = useState(false);

  function pick(position: 'next' | 'end') {
    setOpen(false);
    void enqueueWithToast(getTracks, position, context);
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      drop={drop}
      trigger={({ open: expanded, toggle, ref }) => (
        <motion.button
          ref={ref}
          type="button"
          onClick={toggle}
          aria-label="Действия с очередью"
          aria-expanded={expanded}
          whileTap={{ scale: 0.9 }}
          transition={spring.snappy}
          className={`${touchTargetClass(size)} rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer`}
        >
          <Icon name="more-vertical" size={16} />
        </motion.button>
      )}
    >
      <PopoverItem
        label="Играть следующим"
        icon={<Icon name="corner-down-right" size={14} />}
        onClick={() => pick('next')}
      />
      <PopoverItem
        label="Добавить в очередь"
        icon={<Icon name="list-plus" size={14} />}
        onClick={() => pick('end')}
      />
    </Popover>
  );
}
