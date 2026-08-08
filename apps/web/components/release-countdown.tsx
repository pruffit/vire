'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'motion/react';
import { PresaveButton } from '@/components/presave-button';
import { Icon } from '@/components/icon';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getTimeLeft(target: number): TimeLeft | null {
  const diff = target - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor(diff / 3_600_000) % 24,
    minutes: Math.floor(diff / 60_000) % 60,
    seconds: Math.floor(diff / 1000) % 60,
  };
}

/**
 * Обратный отсчёт до выхода релиза — вместо плеера, пока SCHEDULED.
 * При обнулении таймера перезагружает страницу — релиз уже доступен.
 */
export function ReleaseCountdown({
  releaseId,
  coverUrl,
  title,
  type,
  artistName,
  artistSlug,
  releaseAtMs,
  presaved,
  isAuthed,
}: {
  releaseId: string;
  coverUrl: string | null;
  title: string;
  type: string;
  artistName: string;
  artistSlug: string;
  releaseAtMs: number;
  presaved: boolean;
  isAuthed: boolean;
}) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(() => getTimeLeft(releaseAtMs));

  useEffect(() => {
    const tick = () => {
      const t = getTimeLeft(releaseAtMs);
      setTimeLeft(t);
      if (!t) window.location.reload(); // вышел — показать релиз
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [releaseAtMs]);

  const dateLabel = new Date(releaseAtMs).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <main className="relative z-10 mx-auto flex min-h-full max-w-md flex-col items-center px-6 py-16 text-center">
      <Link
        href={`/artists/${artistSlug}`}
        className="self-start mb-10 inline-flex items-center gap-1.5 text-xs font-mono opacity-40 hover:opacity-70 transition-opacity"
      >
        <Icon name="arrow-left" size={13} /> {artistName}
      </Link>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative aspect-square w-60 sm:w-72 overflow-hidden rounded-2xl shadow-2xl shadow-black/50 ring-1 ring-white/10"
      >
        {coverUrl ? (
          <Image src={coverUrl} alt={title} fill sizes="288px" className="object-cover" priority />
        ) : (
          <div className="h-full w-full bg-[color-mix(in_oklch,var(--artist-text)_5%,transparent)]" />
        )}
        <div className="absolute inset-0 bg-black/25" />
      </motion.div>

      <p className="mt-8 label-wide opacity-50" style={{ color: 'var(--artist-accent)' }}>
        {type} · скоро
      </p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-balance">{title}</h1>
      <p className="mt-1 text-sm opacity-50">{artistName}</p>

      {timeLeft && (
        <div className="mt-8 flex items-start gap-4 readout sm:gap-6">
          <Unit value={timeLeft.days} label="дней" />
          <Colon />
          <Unit value={timeLeft.hours} label="часов" />
          <Colon />
          <Unit value={timeLeft.minutes} label="минут" />
          <Colon />
          <Unit value={timeLeft.seconds} label="секунд" />
        </div>
      )}

      <p className="mt-8 text-xs opacity-40">Выходит {dateLabel}</p>

      {/* Пресейв: сохранить релиз заранее — при выходе авто-лайк + письмо */}
      <div className="mt-6">
        <PresaveButton releaseId={releaseId} initialPresaved={presaved} isAuthed={isAuthed} />
      </div>
      <p className="mt-3 max-w-xs text-[11px] leading-relaxed opacity-35">
        {isAuthed
          ? 'Добавим релиз в твои «Лайки» и пришлём письмо, когда выйдет.'
          : 'Пришлём письмо на почту, когда релиз выйдет.'}
      </p>
    </main>
  );
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-3xl sm:text-5xl font-bold" style={{ color: 'var(--artist-text)' }}>
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[10px] uppercase tracking-widest opacity-40">{label}</span>
    </div>
  );
}

function Colon() {
  return <span className="text-2xl sm:text-4xl font-bold opacity-20 leading-[1.2]">:</span>;
}
