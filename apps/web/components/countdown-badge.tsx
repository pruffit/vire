'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface Props {
  releaseDate: Date;
  title: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getTimeLeft(target: Date): TimeLeft | null {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return null;
  const seconds = Math.floor(diff / 1000) % 60;
  const minutes = Math.floor(diff / 60000) % 60;
  const hours = Math.floor(diff / 3600000) % 24;
  const days = Math.floor(diff / 86400000);
  return { days, hours, minutes, seconds };
}

export function CountdownBadge({ releaseDate, title }: Props) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(() => getTimeLeft(releaseDate));

  useEffect(() => {
    const tick = () => setTimeLeft(getTimeLeft(releaseDate));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [releaseDate]);

  if (!timeLeft) return null;

  const { days, hours, minutes, seconds } = timeLeft;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="inline-flex items-center gap-3 px-4 py-2 rounded-xl border border-[color-mix(in_oklch,var(--artist-accent)_25%,transparent)] bg-[color-mix(in_oklch,var(--artist-accent)_6%,transparent)]"
      aria-label={`Выходит через ${days} дней`}
    >
      <span className="text-[10px] font-mono uppercase tracking-widest opacity-50">
        Скоро
      </span>
      <div className="flex items-baseline gap-1 font-mono tabular-nums">
        {days > 0 && (
          <TimeUnit value={days} label="д" />
        )}
        <TimeUnit value={hours} label="ч" />
        <TimeUnit value={minutes} label="м" />
        {days === 0 && (
          <TimeUnit value={seconds} label="с" />
        )}
      </div>
      <span className="text-xs opacity-60 max-w-[120px] truncate">{title}</span>
    </motion.div>
  );
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <span className="text-sm">
      <span className="text-[var(--artist-accent)]">{String(value).padStart(2, '0')}</span>
      <span className="text-[10px] opacity-40">{label}</span>
    </span>
  );
}
