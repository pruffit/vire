'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import type { PlayerTrack, PlayContext } from '@/store/player';
import { controls } from '@/lib/player/audio-engine';
import { Icon } from '@/components/icon';
import { toast } from '@/lib/toast';
import { touchTargetClass } from '@/components/popover';
import { AdaptiveMenu, type MenuItem } from '@/components/adaptive-menu';
import { useOfflineStore } from '@/store/offline';
import { toDownloadMeta } from '@/lib/offline/to-download-meta';

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

export function TrackQueueMenu({ getTracks, context, size = 'sm', drop = 'auto', track }: {
  getTracks: Loader;
  context: PlayContext;
  size?: 'sm' | 'md';
  /** 'down' — внутри overflow-hidden контейнеров (peek-шит), где раскрытие вверх клипается. */
  drop?: 'auto' | 'down';
  /** Когда задан — добавляет пункт «Сохранить офлайн»/«Удалить из офлайна» именно для этого трека. */
  track?: PlayerTrack;
}) {
  const [open, setOpen] = useState(false);
  const entries = useOfflineStore((s) => s.entries);
  const download = useOfflineStore((s) => s.download);
  const cancelDownload = useOfflineStore((s) => s.cancel);
  const removeDownload = useOfflineStore((s) => s.remove);
  const hydrate = useOfflineStore((s) => s.hydrate);

  useEffect(() => {
    if (track) void hydrate().catch(() => {});
  }, [track, hydrate]);

  function pick(position: 'next' | 'end') {
    void enqueueWithToast(getTracks, position, context);
  }

  const items: MenuItem[] = [
    { label: 'Играть следующим', icon: <Icon name="corner-down-right" size={14} />, onClick: () => pick('next') },
    { label: 'Добавить в очередь', icon: <Icon name="list-plus" size={14} />, onClick: () => pick('end') },
  ];

  if (track) {
    const entry = entries.get(track.id);
    const status = entry?.status ?? 'idle';
    if (status === 'downloading') {
      const pct = entry && entry.total > 0 ? Math.round((entry.done / entry.total) * 100) : 0;
      items.push({
        label: `Сохраняю… ${pct}%`,
        icon: <Icon name="x" size={14} />,
        onClick: () => cancelDownload(track.id),
      });
    } else if (status === 'done') {
      items.push({
        label: 'Удалить из офлайна',
        icon: <Icon name="trash-2" size={14} />,
        onClick: () => removeDownload(track.id),
      });
    } else {
      items.push({
        label: status === 'partial' ? 'Докачать офлайн' : 'Сохранить офлайн',
        icon: <Icon name="save" size={14} />,
        onClick: () => download(toDownloadMeta(track)),
      });
    }
  }

  return (
    <AdaptiveMenu
      open={open}
      onOpenChange={setOpen}
      drop={drop}
      title="Очередь"
      items={items}
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
    />
  );
}
