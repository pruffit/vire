'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/icon';
import { isDesktopApp } from '@/lib/desktop-app';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function isStandalone(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

export function InstallAppButton() {
  const t = useTranslations('pwa.install');
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  // SSR: matchMedia недоступен, но deferred=null всё равно скрывает кнопку до первого
  // клиентского события — начальное значение installed на гидратацию не влияет.
  const [installed, setInstalled] = useState(() => (typeof window === 'undefined' ? false : isStandalone()));
  const [isDesktop] = useState(() => isDesktopApp());

  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferred(null);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (isDesktop || installed || !deferred) return null;

  async function handleClick() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === 'accepted') setInstalled(true);
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      className="flex items-center gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3.5 text-left transition-colors hover:border-foreground/20 hover:bg-foreground/[0.06] w-full pointer-coarse:min-h-11"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-foreground/10">
        <Icon name="maximize" size={22} className="text-foreground/70" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{t('label')}</span>
        <span className="block text-xs text-foreground/50">{t('hint')}</span>
      </span>
      <Icon name="chevron-right" size={18} className="shrink-0 text-foreground/30" />
    </button>
  );
}
