import type { JamQueueSource } from '@vire/core';
import { PlatformIcon } from '@/components/platform-icon';
import { Icon } from '@/components/icon';

const LABEL: Record<Exclude<JamQueueSource, 'VIRE'>, string> = {
  YOUTUBE: 'YouTube',
  SOUNDCLOUD: 'SoundCloud',
  LOCAL: 'Файл',
};

/** Бейдж источника внешней позиции очереди вечеринки — VIRE не рендерит ничего (своё, без подписи). */
export function SourceBadge({ source }: { source: JamQueueSource }) {
  if (source === 'VIRE') return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground/80">
      {source === 'LOCAL' ? <Icon name="file" size={11} /> : <PlatformIcon platform={source === 'YOUTUBE' ? 'youtube' : 'soundcloud'} size={11} />}
      {LABEL[source]}
    </span>
  );
}
