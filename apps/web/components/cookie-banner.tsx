'use client';

import { useState, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { spring } from '@vire/ui/motion';

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
  const [dismissed, setDismissed] = useState(false);
  // useSyncExternalStore: сервер → false (пустой снепшот), клиент → читает localStorage
  const storageNotDismissed = useSyncExternalStore(
    () => () => {}, // подписка не нужна — значение не меняется извне
    getStorageSnapshot,
    getServerSnapshot,
  );

  const visible = storageNotDismissed && !dismissed;

  function dismiss() {
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
          aria-label="Уведомление об использовании cookie"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={spring.snappy}
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 pointer-events-auto"
        >
          <div className="rounded-xl bg-card border border-border/60 shadow-xl shadow-black/30 px-4 py-3 flex items-start gap-3 backdrop-blur-sm">
            <p className="flex-1 text-xs text-muted-foreground leading-relaxed">
              Мы используем только необходимые cookie для работы сайта — сессия авторизации. Сторонней аналитики нет.
            </p>
            <button
              onClick={dismiss}
              className="shrink-0 text-xs font-medium text-foreground hover:opacity-70 transition-opacity mt-0.5 cursor-pointer"
            >
              Понятно
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
