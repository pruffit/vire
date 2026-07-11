'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { Icon, type IconName } from './icon';
import { BrandIcon, type BrandName } from './brand-icon';

/** Событие запуска «праздника» (нотный дождь) — можно слать из любого места. */
export const PARTY_EVENT = 'vire:party';

// e.code, не e.key — работает на любой раскладке
const KONAMI = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA',
];

export function EasterEggs() {
  const [party, setParty] = useState(false);
  const [secret, setSecret] = useState(false);
  const partyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (partyTimerRef.current) clearTimeout(partyTimerRef.current); }, []);

  const startParty = () => {
    if (partyTimerRef.current) clearTimeout(partyTimerRef.current);
    setParty(true);
    partyTimerRef.current = setTimeout(() => setParty(false), 3400);
  };

  useEffect(() => {
    console.log('%cVire ♪', 'font:800 30px/1 system-ui;letter-spacing:1px');
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

  useEffect(() => {
    const onParty = () => startParty();
    window.addEventListener(PARTY_EVENT, onParty);
    return () => window.removeEventListener(PARTY_EVENT, onParty);
  }, []);

  return (
    <>
      <AnimatePresence>{party && <NoteRain key="note-rain" />}</AnimatePresence>
      <AnimatePresence>{secret && <SecretPopup onClose={() => setSecret(false)} />}</AnimatePresence>
    </>
  );
}

// ─── Секретный попап (Konami) ─────────────────────────────────────────────────

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

// ─── Нотный дождь (тройной клик по копирайту) ────────────────────────────────

type RainPiece = { type: 'brand'; name: BrandName } | { type: 'icon'; name: IconName };

const BRAND_PIECES: BrandName[] = [
  'vk', 'x', 'instagram', 'telegram', 'tiktok', 'twitch', 'discord', 'facebook',
  'bluesky', 'apple-music', 'bandcamp', 'deezer', 'youtube-music',
];
const ICON_PIECES: IconName[] = ['music', 'heart', 'star', 'play-circle', 'shuffle', 'volume-2'];
const ICON_COLORS = ['#1ED760', '#FF0033', '#0077FF', '#A335FF', '#FF5500', '#34D1D9'];

const POOL: RainPiece[] = [
  ...BRAND_PIECES.map((name): RainPiece => ({ type: 'brand', name })),
  ...ICON_PIECES.map((name): RainPiece => ({ type: 'icon', name })),
];

function NoteRain() {
  const [items] = useState(() =>
    Array.from({ length: 32 }, (_, i) => ({
      id: i,
      piece: POOL[Math.floor(Math.random() * POOL.length)],
      left: Math.random() * 100,
      delay: Math.random() * 1,
      duration: 2.6 + Math.random() * 1.4,
      size: 22 + Math.round(Math.random() * 26),
      color: ICON_COLORS[Math.floor(Math.random() * ICON_COLORS.length)],
      spin: Math.random() > 0.5 ? 220 : -220,
    })),
  );

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[90] overflow-hidden"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {items.map((n) => (
        <motion.span
          key={n.id}
          className="absolute inline-flex select-none drop-shadow"
          style={{ left: `${n.left}%`, top: -56 }}
          initial={{ y: -56, opacity: 0, rotate: -20 }}
          animate={{ y: '114vh', opacity: [0, 1, 1, 0], rotate: n.spin }}
          transition={{ duration: n.duration, delay: n.delay, ease: 'easeIn' }}
        >
          {n.piece.type === 'brand' ? (
            <BrandIcon name={n.piece.name} size={n.size} />
          ) : (
            <Icon name={n.piece.name} size={n.size} style={{ color: n.color }} />
          )}
        </motion.span>
      ))}
    </motion.div>
  );
}

/** Тройной клик по содержимому запускает нотный дождь («© Vire» в футере). */
export function PartyText({ children, className }: { children: ReactNode; className?: string }) {
  const clicks = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onClick = () => {
    clicks.current += 1;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => (clicks.current = 0), 600);
    if (clicks.current >= 3) {
      clicks.current = 0;
      window.dispatchEvent(new Event(PARTY_EVENT));
    }
  };

  return (
    <span onClick={onClick} className={className}>
      {children}
    </span>
  );
}
