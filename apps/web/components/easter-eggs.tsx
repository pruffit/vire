'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// Пасхалки. Безвредные, выключаются сами, не мешают UI и доступности
// (декоративный слой pointer-events-none). Konami запускается только вне полей ввода.

const KONAMI = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a',
];

export function EasterEggs() {
  const [party, setParty] = useState(false);

  // 1) Привет в консоли — для тех, кто заглянул в devtools.
  useEffect(() => {
    console.log('%cVire ♪', 'font-size:30px;font-weight:800;letter-spacing:1px');
    console.log(
      '%cНезависимая музыка для СНГ. Копаешься в коде? Нам по пути — /feedback',
      'font-size:13px;font-weight:600',
    );
    console.log('%c↑ ↑ ↓ ↓ ← → ← → B A', 'font-family:monospace;color:#7c7c7c');
  }, []);

  // 2) Konami-код → нотный дождь.
  useEffect(() => {
    let buf: string[] = [];
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      buf = [...buf, e.key].slice(-KONAMI.length);
      if (buf.length === KONAMI.length && KONAMI.every((k, i) => k.toLowerCase() === buf[i].toLowerCase())) {
        buf = [];
        setParty(true);
        window.setTimeout(() => setParty(false), 3400);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
