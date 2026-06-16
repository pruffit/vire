'use client';

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { spring } from '@vire/ui/motion';

// Координатор одноразовых анонсов. Главная задача — несколько важных модалок
// (изменения входа, запуск Этапа 1, будущие) НЕ показываются одновременно:
// они выстраиваются в очередь и всплывают по одной. Каждая помнит свой показ
// через localStorage и переоткрывается из футера (кнопка AnnouncementReopenLink).
//
// Версионируй storageKey (…_v1 → _v2), если нужно показать анонс заново всем.

export const OPEN_ANNOUNCEMENT_EVENT = 'vire:open-announcement';

interface Announcement {
  id: string;
  /** Ключ localStorage — флаг «уже видел». Версионируется. */
  storageKey: string;
  /** Подпись кнопки переоткрытия в футере. */
  footerLabel: string;
  title: string;
  body: ReactNode;
  cta?: { href: string; label: string };
}

// Порядок = очередь авто-показа. Сначала — приветствие запуска, затем про вход.
const ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'stage1',
    storageKey: 'vire_notice_stage1_v1',
    footerLabel: 'Что нового',
    title: 'Vire запущен',
    body: (
      <>
        <p>
          Это <strong className="text-foreground">Этап 1 — Friends &amp; Family</strong>. Уже можно
          слушать артистов, собирать плейлисты, ставить лайки и запускать{' '}
          <strong className="text-foreground">Волну</strong> — поток по вкусу.
        </p>
        <p>
          Прямые продажи и поддержка артистов рублём появятся на следующем этапе. Спасибо, что вы
          с нами с самого начала.
        </p>
      </>
    ),
    cta: { href: '/about', label: 'Что уже работает' },
  },
  {
    id: 'auth',
    storageKey: 'vire_notice_auth_v1',
    footerLabel: 'Изменения во входе',
    title: 'Изменения во входе',
    body: (
      <>
        <p>
          Чтобы соответствовать требованиям закона РФ (ФЗ-406), мы убрали вход через{' '}
          <strong className="text-foreground">Google</strong> и{' '}
          <strong className="text-foreground">Telegram</strong>: российским сайтам нельзя
          использовать иностранные сервисы авторизации.
        </p>
        <p>
          Войти теперь можно по <strong className="text-foreground">email и паролю</strong>, по{' '}
          <strong className="text-foreground">ссылке на email</strong> или через{' '}
          <strong className="text-foreground">Яндекс</strong>.
        </p>
        <p>
          Если раньше ты заходил через Google или Telegram — на странице входа выбери «Войти по
          ссылке на email», а затем задай пароль в профиле, раздел «Способы входа».
        </p>
      </>
    ),
    cta: { href: '/privacy', label: 'Подробнее' },
  },
];

function isSeen(key: string): boolean {
  try {
    return !!localStorage.getItem(key);
  } catch {
    return true; // нет доступа к localStorage — не навязываемся
  }
}

function markSeen(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    /* ignore */
  }
}

export function Announcements() {
  // Первый непросмотренный анонс из очереди. useSyncExternalStore читает
  // localStorage без setState-в-эффекте и без рассинхрона с SSR (сервер → null).
  const autoActiveId = useSyncExternalStore(
    () => () => {},
    () => ANNOUNCEMENTS.find((a) => !isSeen(a.storageKey))?.id ?? null,
    () => null,
  );
  // Ручное открытие из футера (перебивает авто-очередь).
  const [manualId, setManualId] = useState<string | null>(null);
  // Тик для перечитывания localStorage после markSeen (переход к следующему).
  const [, bump] = useState(0);

  const active = ANNOUNCEMENTS.find((a) => a.id === (manualId ?? autoActiveId)) ?? null;

  // Переоткрытие из футера.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      if (id) setManualId(id);
    };
    window.addEventListener(OPEN_ANNOUNCEMENT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_ANNOUNCEMENT_EVENT, onOpen);
  }, []);

  const close = useCallback(() => {
    if (!active) return;
    if (manualId) {
      setManualId(null); // ручное открытие — просто закрыть, авто-флаг не трогаем
    } else {
      markSeen(active.storageKey); // авто — отметить и показать следующий непросмотренный
      bump((n) => n + 1);
    }
  }, [active, manualId]);

  // Esc закрывает.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, close]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="announcement-title"
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
            <h2 id="announcement-title" className="text-lg font-semibold tracking-tight">
              {active.title}
            </h2>

            <div className="text-sm text-muted-foreground leading-relaxed space-y-3">
              {active.body}
            </div>

            <div className="flex items-center justify-end gap-1 pt-1">
              {active.cta && (
                <Link
                  href={active.cta.href}
                  onClick={close}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {active.cta.label}
                </Link>
              )}
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

/** Кнопка-ссылка для футера: снова открывает конкретный анонс по id. */
export function AnnouncementReopenLink({ id, className }: { id: string; className?: string }) {
  const a = ANNOUNCEMENTS.find((x) => x.id === id);
  if (!a) return null;
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(new CustomEvent(OPEN_ANNOUNCEMENT_EVENT, { detail: { id } }))
      }
      className={className}
    >
      {a.footerLabel}
    </button>
  );
}
