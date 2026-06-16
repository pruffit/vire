'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';

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

function NoteRain() {
  // Ленивый инициализатор — Math.random зовётся один раз, рендер остаётся чистым.
  const [items] = useState(() => {
    const glyphs = ['♪', '♫', '♬', '🎵', '🎶', '🌊'];
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.9,
      duration: 2.4 + Math.random() * 1.3,
      glyph: glyphs[i % glyphs.length],
      size: 18 + Math.random() * 24,
    }));
  });

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
          className="absolute select-none"
          style={{ left: `${n.left}%`, top: -48, fontSize: n.size }}
          initial={{ y: -48, opacity: 0, rotate: -20 }}
          animate={{ y: '112vh', opacity: [0, 1, 1, 0], rotate: 200 }}
          transition={{ duration: n.duration, delay: n.delay, ease: 'easeIn' }}
        >
          {n.glyph}
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
