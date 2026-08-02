'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { Icon } from './icon';

// e.code, не e.key — работает на любой раскладке
const KONAMI = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA',
];

export function EasterEggs() {
  const [secret, setSecret] = useState(false);

  useEffect(() => {
    console.log('%cVireMusic ♪', 'font:800 30px/1 system-ui;letter-spacing:1px');
    console.log(
      '%cНезависимая музыка для СНГ. Копаешься в коде? Нам по пути → /feedback?type=other',
      'font:600 13px/1.5 system-ui',
    );
    console.log('%c↑ ↑ ↓ ↓ ← → ← → B A', 'font-family:monospace;color:#7c7c7c');
  }, []);

  useEffect(() => {
    let buf: string[] = [];
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      buf = [...buf, e.code].slice(-KONAMI.length);
      if (buf.length === KONAMI.length && KONAMI.every((c, i) => c === buf[i])) {
        buf = [];
        setSecret(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <AnimatePresence>{secret && <SecretPopup onClose={() => setSecret(false)} />}</AnimatePresence>
  );
}

function SecretPopup({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/70 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={spring.smooth}
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-xs w-full rounded-2xl border border-border bg-card p-8 text-center space-y-5 shadow-2xl"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 rounded-2xl opacity-40"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in oklch, var(--primary) 40%, transparent), transparent)' }}
        />
        <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase">
          ↑ ↑ ↓ ↓ ← → ← → B A
        </p>
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold tracking-tight">Ты знаешь коды</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Здесь что-то есть. Войдёшь?
          </p>
        </div>
        <Link
          href="/fwqa688"
          onClick={onClose}
          className="flex items-center justify-center gap-1.5 rounded-full bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:bg-primary/90 transition-opacity"
        >
          Войти <Icon name="arrow-right" size={14} />
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="block w-full text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          Уйти
        </button>
      </motion.div>
    </motion.div>
  );
}
