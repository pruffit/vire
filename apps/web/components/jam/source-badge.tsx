import { useTranslations } from 'next-intl';
import type { JamQueueSource } from '@vire/core';
import { PlatformIcon } from '@/components/platform-icon';
import { Icon } from '@/components/icon';

const LABEL: Record<Exclude<JamQueueSource, 'VIRE'>, string | null> = {
  YOUTUBE: 'YouTube',
  SOUNDCLOUD: 'SoundCloud',
  AUDIUS: 'Audius',
  LOCAL: null,
};

/** Бейдж источника внешней позиции очереди вечеринки — VIRE не рендерит ничего (своё, без подписи). */
export function SourceBadge({ source }: { source: JamQueueSource }) {
  const t = useTranslations('jam.sourceLabels');
  if (source === 'VIRE') return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground/80">
      {source === 'YOUTUBE' || source === 'SOUNDCLOUD' ? (
        <PlatformIcon platform={source === 'YOUTUBE' ? 'youtube' : 'soundcloud'} size={11} />
      ) : (
        <Icon name={source === 'AUDIUS' ? 'music' : 'file'} size={11} />
      )}
      {LABEL[source] ?? t('LOCAL')}
    </span>
  );
}
