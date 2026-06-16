'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { spring } from '@vire/ui/motion';

// Версионируем ключ: если позже будет ещё одно важное изменение — поднимем номер
// и уведомление снова покажется один раз каждому.
const STORAGE_KEY = 'vire_notice_auth_v1';

/** Событие, которым ссылка в футере просит снова открыть уведомление. */
export const OPEN_NOTICE_EVENT = 'vire:open-compliance-notice';

function getAutoSnapshot(): boolean {
  try {
    return !localStorage.getItem(STORAGE_KEY); // ещё не видел → показать
  } catch {
    return false;
  }
}

/**
 * Одноразовое уведомление при первом заходе: что изменилось во входе и почему.
 * Показывается один раз (флаг в localStorage), дальше открывается вручную из
 * футера (событие OPEN_NOTICE_EVENT).
 */
export function ComplianceNotice() {
  // Авто-показ при первом заходе. useSyncExternalStore читает localStorage без
  // setState-в-эффекте и без SSR-рассинхрона (сервер → false).
  const autoShow = useSyncExternalStore(() => () => {}, getAutoSnapshot, () => false);
  // null — следуем авто-показу; true/false — ручное открытие/закрытие.
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? autoShow;

  useEffect(() => {
    const reopen = () => setOverride(true);
    window.addEventListener(OPEN_NOTICE_EVENT, reopen);
    return () => window.removeEventListener(OPEN_NOTICE_EVENT, reopen);
  }, []);

  // Esc закрывает
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function close() {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setOverride(false);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="compliance-notice-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={close}
          className="fixed inset-0 z-[80] grid place-items-center p-4 bg-black/70"
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={spring.snappy}
            className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl shadow-black/40 p-6 space-y-4"
          >
            <h2 id="compliance-notice-title" className="text-lg font-semibold tracking-tight">
              Изменения во входе
            </h2>

            <div className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>
                Чтобы соответствовать требованиям закона РФ (ФЗ-406), мы убрали вход через{' '}
                <strong className="text-foreground">Google</strong> и{' '}
                <strong className="text-foreground">Telegram</strong>: российским сайтам нельзя
                использовать иностранные сервисы авторизации.
              </p>
              <p>
                Войти теперь можно по <strong className="text-foreground">email и паролю</strong>,
                по <strong className="text-foreground">ссылке на email</strong> или через{' '}
                <strong className="text-foreground">Яндекс</strong>.
              </p>
              <p>
                Если раньше ты заходил через Google или Telegram — на странице входа выбери «Войти
                по ссылке на email», а затем задай пароль в профиле, раздел «Способы входа».
              </p>
            </div>

            <div className="flex items-center justify-end gap-1 pt-1">
              <a
                href="/privacy"
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Подробнее
              </a>
              <button
                type="button"
                onClick={close}
                className="rounded-full bg-primary text-primary-foreground px-5 py-2 text-sm font-medium hover:bg-primary/90 transition-opacity cursor-pointer"
              >
                Понятно
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Кнопка-ссылка для футера: снова открывает уведомление. */
export function NoticeReopenLink({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_NOTICE_EVENT))}
      className={className}
    >
      Изменения во входе
    </button>
  );
}
