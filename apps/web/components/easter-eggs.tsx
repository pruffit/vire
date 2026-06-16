'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Icon, type IconName } from './icon';
import { BrandIcon, type BrandName } from './brand-icon';

// Пасхалки. Безвредные, выключаются сами, не мешают UI и доступности
// (декоративный слой pointer-events-none). Без вывода в консоль.

/** Событие запуска «праздника» (нотный дождь) — можно слать из любого места. */
export const PARTY_EVENT = 'vire:party';

// e.code (а не e.key) — чтобы код работал на любой раскладке клавиатуры.
const KONAMI = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA',
];

export function EasterEggs() {
  const [party, setParty] = useState(false);

  const start = () => {
    setParty(true);
    window.setTimeout(() => setParty(false), 3400);
  };

  // Приветствие для тех, кто заглянул в devtools.
  useEffect(() => {
    console.log('%cVire ♪', 'font:800 30px/1 system-ui;letter-spacing:1px');
    console.log(
      '%cНезависимая музыка для СНГ. Копаешься в коде? Нам по пути → /feedback?type=other',
      'font:600 13px/1.5 system-ui',
    );
    console.log('%c↑ ↑ ↓ ↓ ← → ← → B A', 'font-family:monospace;color:#7c7c7c');
  }, []);

  // Konami-код → нотный дождь.
  useEffect(() => {
    let buf: string[] = [];
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      buf = [...buf, e.code].slice(-KONAMI.length);
      if (buf.length === KONAMI.length && KONAMI.every((c, i) => c === buf[i])) {
        buf = [];
        start();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Внешний триггер (напр. тройной клик по «© Vire» в футере).
  useEffect(() => {
    const onParty = () => start();
    window.addEventListener(PARTY_EVENT, onParty);
    return () => window.removeEventListener(PARTY_EVENT, onParty);
  }, []);

  return <AnimatePresence>{party && <NoteRain key="note-rain" />}</AnimatePresence>;
}

// Дождь из НАШИХ иконок — бренды площадок/соцсетей (цветные) + системные глифы.
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
  // Ленивый инициализатор — Math.random зовётся один раз, рендер остаётся чистым.
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

/**
 * Обёртка-триггер: тройной клик по содержимому запускает нотный дождь.
 * Используется для «© Vire» в футере — скрытый интерактивный прикол.
 */
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
