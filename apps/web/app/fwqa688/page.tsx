'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { blackSkyProgress } from '@/lib/black-sky';

const LINES = [
  'связь установлена',
  'инициализация...',
  'загрузка протокола',
  'доступ получен',
];

const MORSE = '...- .. .-. .';  // VIRE в азбуке Морзе

export default function SecretPage() {
  const [lineIdx, setLineIdx] = useState(0);
  const [glitch, setGlitch] = useState(false);
  const [progress] = useState(() => blackSkyProgress(new Date()));
  const [fillPct, setFillPct] = useState(0);
  const [progressNoise, setProgressNoise] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      setLineIdx((i) => (i + 1) % LINES.length);
    }, 1800);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const pulse = setInterval(() => {
      setGlitch(true);
      t = setTimeout(() => setGlitch(false), 120);
    }, 4000);
    return () => {
      clearInterval(pulse);
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setFillPct(progress));
    return () => cancelAnimationFrame(raf);
  }, [progress]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const pulse = setInterval(() => {
      const noise = String(Math.floor(Math.random() * 100)).padStart(2, '0');
      setProgressNoise(noise);
      t = setTimeout(() => setProgressNoise(null), 150);
    }, 6200);
    return () => {
      clearInterval(pulse);
      clearTimeout(t);
    };
  }, []);

  const progressLabel = progressNoise
    ? `${progress.toFixed(4).slice(0, -2)}${progressNoise}`
    : progress.toFixed(4);

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6 py-24 select-none">
      {/* атмосферное свечение */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 40%, color-mix(in oklch, var(--primary) 12%, transparent), transparent)',
        }}
      />

      <div className="text-center space-y-10 max-w-sm">
        {/* логотип с глитчем */}
        <motion.div
          animate={glitch ? { x: [0, -3, 3, -1, 0], opacity: [1, 0.6, 1] } : {}}
          transition={{ duration: 0.12 }}
          className="font-mono text-xs tracking-[0.3em] text-primary/60 uppercase"
        >
          {MORSE}
        </motion.div>

        {/* бегущая строка терминала */}
        <div className="h-6 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.p
              key={lineIdx}
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -12, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="font-mono text-xs text-muted-foreground/60"
            >
              {'> '}{LINES[lineIdx]}
              <BlinkCursor />
            </motion.p>
          </AnimatePresence>
        </div>

        {/* главное сообщение */}
        <div className="space-y-3">
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="text-3xl font-bold tracking-tight"
          >
            Ожидайте изменений
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="text-sm text-muted-foreground leading-relaxed"
          >
            Что-то готовится. Те, кто знает — узнают первыми.
          </motion.p>
        </div>

        {/* прогресс «чёрного неба» */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-2"
        >
          <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground/60">
            <span>{'> '}готовность протокола</span>
            <span className="tabular-nums" suppressHydrationWarning>{progressLabel}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-primary/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-[2000ms] ease-out"
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </motion.div>

        {/* пульсирующая точка */}
        <motion.div
          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          className="mx-auto size-1.5 rounded-full bg-primary"
        />
      </div>
    </div>
  );
}

function BlinkCursor() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setOn((v) => !v), 530);
    return () => clearInterval(t);
  }, []);
  return <span className={on ? 'opacity-100' : 'opacity-0'}>_</span>;
}
