'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { Icon, type IconName } from '@/components/icon';
import { GlowBackdrop } from '@/components/content-kit';
import { OPEN_ANNOUNCEMENT_EVENT } from '@/components/widget-triggers';
import { nextAutoAnnouncement } from '@/lib/announcements-queue';

// Авто-показ: максимум один анонс за визит; остальные — в следующие заходы.
// Версионируй storageKey (…_v1 → _v2), чтобы показать анонс заново всем.

interface Announcement {
  id: string;
  storageKey: string;
  title: string;
  body: ReactNode;
  icon?: IconName;
  cta?: { href: string; label: string };
}

function useAnnouncements(): Announcement[] {
  const t = useTranslations();
  const strong = (chunks: ReactNode) => <strong className="text-foreground">{chunks}</strong>;

  // порядок = очередь авто-показа
  return [
    {
      id: 'stage1',
      storageKey: 'vire_notice_stage1_v1',
      title: t('artist.announcements.stage1.title'),
      icon: 'star',
      body: (
        <>
          <p>{t.rich('artist.announcements.stage1.body1', { strong })}</p>
          <p>{t('artist.announcements.stage1.body2')}</p>
        </>
      ),
      cta: { href: '/about', label: t('artist.announcements.stage1.cta') },
    },
    {
      id: 'auth',
      storageKey: 'vire_notice_auth_v1',
      title: t('nav.footer.authChanges'),
      icon: 'lock',
      body: (
        <>
          <p>{t.rich('artist.announcements.auth.body1', { strong })}</p>
          <p>{t.rich('artist.announcements.auth.body2', { strong })}</p>
          <p>{t('artist.announcements.auth.body3')}</p>
        </>
      ),
      cta: { href: '/privacy', label: t('artist.announcements.auth.cta') },
    },
  ];
}

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
  const t = useTranslations('artist.announcements');
  const announcements = useAnnouncements();
  // useSyncExternalStore читает localStorage без setState-в-эффекте и рассинхрона с SSR
  const autoActiveId = useSyncExternalStore(
    () => () => {},
    () => nextAutoAnnouncement(announcements, isSeen)?.id ?? null,
    () => null,
  );
  const [manualId, setManualId] = useState<string | null>(null);
  const [autoConsumed, setAutoConsumed] = useState(false);

  const active =
    announcements.find((a) => a.id === (manualId ?? (autoConsumed ? null : autoActiveId))) ?? null;

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
      markSeen(active.storageKey);
      setAutoConsumed(true); // максимум один авто-анонс за визит; следующий — при следующем заходе
    }
  }, [active, manualId]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, close]);

  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (active) confirmRef.current?.focus();
  }, [active]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={close}
          className="fixed inset-0 z-[80] grid place-items-center p-4 bg-background/70"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="announcement-title"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={spring.snappy}
            className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl shadow-background/40 p-6 space-y-4 overflow-hidden"
          >
            <GlowBackdrop corner />

            <div className="space-y-3">
              {active.icon && (
                <div className="grid size-10 place-items-center rounded-xl border border-primary/30 bg-primary/10">
                  <Icon name={active.icon} size={20} className="text-primary" />
                </div>
              )}
              <h2 id="announcement-title" className="text-lg font-semibold tracking-tight">
                {active.title}
              </h2>
            </div>

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
                ref={confirmRef}
                type="button"
                onClick={close}
                className="rounded-full bg-primary text-primary-foreground px-5 py-2 text-sm font-medium hover:bg-primary/90 transition-opacity cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                {t('ok')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
