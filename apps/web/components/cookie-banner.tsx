'use client';

import { useState, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslations } from 'next-intl';
import { spring } from '@vire/ui/motion';
import { Link } from '@/i18n/navigation';

const STORAGE_KEY = 'vire_cookie_ok';

function getStorageSnapshot(): boolean {
  try {
    return !localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false; // на сервере баннер не показываем
}

export function CookieBanner() {
  const t = useTranslations('common.cookieBanner');
  const [dismissed, setDismissed] = useState(false);
  // useSyncExternalStore: сервер → false (пустой снепшот), клиент → читает localStorage
  const storageNotDismissed = useSyncExternalStore(
    () => () => {}, // подписка не нужна: значение не меняется извне
    getStorageSnapshot,
    getServerSnapshot,
  );

  const visible = storageNotDismissed && !dismissed;

  function decide(choice: 'accepted' | 'rejected') {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch { /* ignore */ }
    setDismissed(true);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="region"
          aria-label={t('aria')}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={spring.snappy}
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 pointer-events-auto"
        >
          <div className="rounded-xl bg-card border border-border/60 shadow-xl shadow-background/30 px-4 py-3.5 space-y-3 backdrop-blur-sm">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('text')}{' '}
              <Link href="/privacy" className="underline underline-offset-2 hover:opacity-70 transition-opacity">
                {t('learnMore')}
              </Link>
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => decide('rejected')}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 cursor-pointer"
              >
                {t('reject')}
              </button>
              <button
                onClick={() => decide('accepted')}
                className="text-xs font-medium rounded-full bg-primary text-primary-foreground px-4 py-1.5 hover:bg-primary/90 transition-opacity cursor-pointer"
              >
                {t('accept')}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
