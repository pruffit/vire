'use client';

import { useState, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslations } from 'next-intl';
import { spring } from '@vire/ui/motion';
import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/icon';
import { detectPlatform } from '@/lib/platform-detect';
import { isDesktopApp } from '@/lib/desktop-app';

const STORAGE_KEY = 'vire_desktop_banner_dismissed_v1';

function getStorageSnapshot(): boolean {
  try {
    return !localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false; // на сервере баннер не показываем — платформа известна только клиенту
}

export function DesktopDownloadBanner() {
  const t = useTranslations('download.banner');
  const [dismissed, setDismissed] = useState(false);
  const storageNotDismissed = useSyncExternalStore(() => () => {}, getStorageSnapshot, getServerSnapshot);
  const [platform] = useState(() =>
    !isDesktopApp() && typeof navigator !== 'undefined'
      ? detectPlatform(navigator.userAgent, navigator.maxTouchPoints)
      : 'unknown',
  );
  const isDesktopPlatform = platform === 'windows' || platform === 'linux';
  const os = platform === 'windows' ? 'Windows' : 'Linux';

  const visible = isDesktopPlatform && storageNotDismissed && !dismissed;

  function close() {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch { /* ignore */ }
    setDismissed(true);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="region"
          aria-label={t('text', { os })}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={spring.snappy}
          className="fixed left-4 right-4 top-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 pointer-events-auto"
        >
          <div className="flex items-start gap-3 rounded-xl bg-card border border-primary/30 shadow-xl shadow-background/30 px-4 py-3.5 backdrop-blur-sm">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10">
              <Icon name="layout" size={16} className="text-primary" />
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-xs text-foreground/90 leading-relaxed">{t('text', { os })}</p>
              <div className="flex items-center gap-2">
                <Link
                  href={platform === 'windows' ? '/download#windows' : '/download#linux'}
                  onClick={close}
                  className="rounded-full bg-primary text-primary-foreground px-3.5 py-1.5 text-xs font-medium hover:bg-primary/90 transition-opacity"
                >
                  {t('cta')}
                </Link>
              </div>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label={t('closeAria')}
              className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
