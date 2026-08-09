'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
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
type QueueTranslator = (key: string) => string;

export async function enqueueWithToast(
  load: Loader,
  position: 'next' | 'end',
  context: PlayContext,
  t: QueueTranslator,
): Promise<void> {
  const tracks = await load();
  if (!tracks || tracks.length === 0) {
    toast.error(t('loadFailed'));
    return;
  }
  const inserted = controls.enqueue(tracks, position, context);
  if (inserted === 0) toast(t('alreadyQueued'));
  else toast(position === 'next' ? t('willPlayNext') : t('queued'));
}

export function TrackQueueMenu({ getTracks, context, size = 'sm', drop = 'auto', track, variant = 'platform' }: {
  /** Необязателен: без него в очередь идёт сам `track`. Серверные страницы функции
   *  в клиентский компонент передать не могут — им остаются только сериализуемые пропсы. */
  getTracks?: Loader;
  context: PlayContext;
  size?: 'sm' | 'md';
  /** 'down' — внутри overflow-hidden контейнеров (peek-шит), где раскрытие вверх клипается. */
  drop?: 'auto' | 'down';
  /** Когда задан — добавляет пункт «Сохранить офлайн»/«Удалить из офлайна» именно для этого трека. */
  track?: PlayerTrack;
  /** 'artist' — страницы с темой артиста: цвет берётся из её токенов, а не платформенных. */
  variant?: 'platform' | 'artist';
}) {
  const t = useTranslations('track.queue');
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
    const load: Loader = getTracks ?? (() => (track ? [track] : []));
    void enqueueWithToast(load, position, context, t);
  }

  const items: MenuItem[] = [
    { label: t('playNext'), icon: <Icon name="corner-down-right" size={14} />, onClick: () => pick('next') },
    { label: t('addToQueue'), icon: <Icon name="list-plus" size={14} />, onClick: () => pick('end') },
  ];

  if (track) {
    const entry = entries.get(track.id);
    const status = entry?.status ?? 'idle';
    if (status === 'downloading') {
      const pct = entry && entry.total > 0 ? Math.round((entry.done / entry.total) * 100) : 0;
      items.push({
        label: t('downloading', { pct }),
        icon: <Icon name="x" size={14} />,
        onClick: () => cancelDownload(track.id),
      });
    } else if (status === 'done') {
      items.push({
        label: t('removeOffline'),
        icon: <Icon name="trash-2" size={14} />,
        onClick: () => removeDownload(track.id),
      });
    } else {
      items.push({
        label: status === 'partial' ? t('resumeOffline') : t('saveOffline'),
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
      title={t('title')}
      items={items}
      trigger={({ open: expanded, toggle, ref }) => (
        <motion.button
          ref={ref}
          type="button"
          onClick={toggle}
          aria-label={t('aria')}
          aria-expanded={expanded}
          whileTap={{ scale: 0.9 }}
          transition={spring.snappy}
          className={`${touchTargetClass(size)} rounded-full flex items-center justify-center transition-colors cursor-pointer ${
            variant === 'artist'
              ? 'text-[color-mix(in_oklch,var(--artist-text)_40%,transparent)] hover:text-[color-mix(in_oklch,var(--artist-text)_90%,transparent)]'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Icon name="more-vertical" size={16} />
        </motion.button>
      )}
    />
  );
}
