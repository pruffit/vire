'use client';

import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/icon';
import { isDesktopApp } from '@/lib/desktop-app';

function getServerSnapshot(): boolean {
  return false; // на сервере сигнал недоступен — рендерим как в браузере до маунта
}

export function WindowsDownloadCta({ windowsUrl }: { windowsUrl: string | null }) {
  const t = useTranslations('download.platforms.windows');
  const desktop = useSyncExternalStore(() => () => {}, isDesktopApp, getServerSnapshot);

  if (desktop) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-foreground/10 px-5 py-2.5 text-sm font-medium text-foreground/80">
        <Icon name="check" size={15} />
        {t('alreadyInstalled')}
      </span>
    );
  }

  if (!windowsUrl) {
    return (
      <span aria-disabled="true" className="inline-flex cursor-not-allowed items-center gap-2 rounded-full bg-foreground/10 px-5 py-2.5 text-sm font-medium text-muted-foreground">
        {t('cta')}
      </span>
    );
  }

  return (
    <a
      href={windowsUrl}
      className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:bg-primary/90 transition-opacity"
    >
      <Icon name="arrow-right" size={15} />
      {t('cta')}
    </a>
  );
}
