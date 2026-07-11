'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { usePlayerStore } from '@/store/player';
import { controls } from '@/components/player/audio-engine';
import { useLazyQueue } from '@/lib/player/use-play';
import { PlayIcon, PauseIcon } from '@/components/icons';
import { ExplicitBadge } from '@/components/explicit-badge';
import { formatDuration } from '@/lib/format';
import { featuredNames } from '@/lib/track-display';
import { TrackTitleText } from '@/components/track-title';
import { Icon } from '@/components/icon';
import { toast } from '@/components/toast';
import { QuickLookSheet, QuickLookDragHandle, MiniEq } from './quick-look-sheet';

export interface QuickLookRelease {
  id: string;
  title: string;
  coverUrl: string | null;
  type: string;
  artistName: string;
  artistSlug: string;
  releaseDate: Date | string | null;
  /** Любой трек релиза explicit — показываем бейдж (E) у названия. */
  hasExplicit?: boolean;
  accentColor?: string | null;
}

function year(d: Date | string | null): string | null {
  if (!d) return null;
  // UTC — иначе локальная TZ браузера расходится с серверным рендером на границе года (гидрация #418)
  const y = new Date(d).getUTCFullYear();
  return Number.isFinite(y) ? String(y) : null;
}

/** «сегодня» / «завтра» / «через N дн.» / дата — для грядущих релизов. */
function untilLabel(d: Date | string | null): string | null {
  if (!d) return null;
  const date = new Date(d);
  if (!Number.isFinite(date.getTime())) return null;
  const MS = 86_400_000;
  const now = new Date();
  const d0 = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const d1 = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const days = Math.round((d1 - d0) / MS);
  if (days <= 0) return 'сегодня';
  if (days === 1) return 'завтра';
  if (days < 7) return `через ${days} дн.`;
  // timeZone:'UTC' обязателен — иначе расходится с сервером у дат возле границы суток (гидрация #418)
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** Карточка релиза, которая по клику разворачивается в оверлей-«peek» с трек-листом и play. */
export function ReleaseQuickLook({
  release,
  showArtist = true,
  upcoming = false,
  priority = false,
}: {
  release: QuickLookRelease;
  showArtist?: boolean;
  upcoming?: boolean;
  /** Грузить обложку сразу — для первой карточки над сгибом (LCP). */
  priority?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const layoutId = useId();
  const yr = year(release.releaseDate);
  const releaseHref = `/artists/${release.artistSlug}/releases/${release.id}`;

  const activeTrack = usePlayerStore((s) => s.track);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isThisReleasePlaying = activeTrack?.releaseId === release.id;
  const { load, loading, items: tracks } = useLazyQueue('release', release.id, {
    artistName: release.artistName,
    artistSlug: release.artistSlug,
    coverUrl: release.coverUrl,
    accentColor: release.accentColor,
  });
  const context = { source: 'release' as const, sourceId: release.id };

  // Невышедший релиз нельзя слушать: карточка ведёт на страницу с обратным
  // отсчётом, без peek-оверлея и плеера. (Возврат после всех хуков — правило hooks.)
  if (upcoming) {
    return (
      <Link href={releaseHref} className="block w-full text-left group" aria-label={`${release.title} — скоро`}>
        <div className="relative aspect-square rounded-md overflow-hidden bg-muted ring-1 ring-white/5 transition-all duration-300 ease-soft group-hover:ring-white/20 group-hover:shadow-xl group-hover:shadow-black/30">
          {release.coverUrl ? (
            <Image src={release.coverUrl} alt={release.title} fill priority={priority} quality={60} sizes="(max-width: 640px) 45vw, 220px" className="object-cover transition-transform duration-500 ease-soft group-hover:scale-[1.04]" />
          ) : (
            <div className="w-full h-full grid place-items-center opacity-20"><NoteIcon /></div>
          )}
          {release.releaseDate && (
            <span className="absolute top-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-mono text-white/90">
              {untilLabel(release.releaseDate) ?? release.type}
            </span>
          )}
        </div>
        <div className="mt-2.5 space-y-0.5">
          <p className="text-sm font-medium leading-snug group-hover:text-foreground transition-colors flex items-center gap-1.5 min-w-0">
            <span className="truncate">{release.title}</span>
            {release.hasExplicit && <ExplicitBadge />}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {showArtist ? release.artistName : release.type}
            <span className="opacity-50 font-mono">{' · '}{release.type}</span>
          </p>
        </div>
      </Link>
    );
  }

  function openQuickLook() {
    setOpen(true);
    void load().then((queue) => {
      if (queue === null) toast.error('Не удалось загрузить треки');
    });
  }

  async function playFrom(trackId: string) {
    const queue = await load();
    if (queue === null) {
      toast.error('Не удалось загрузить треки');
      return;
    }
    const idx = Math.max(0, queue.findIndex((q) => q.id === trackId));
    if (queue[idx]) controls.playQueue(queue, { startIndex: idx, context });
  }

  async function playAll() {
    const queue = await load();
    if (queue === null) {
      toast.error('Не удалось загрузить треки');
      return;
    }
    if (queue[0]) controls.playQueue(queue, { context });
  }

  const hasReadyTrack = (tracks ?? []).some((t) => t.status === 'READY');

  return (
    <>
      <motion.button
        type="button"
        layoutId={layoutId}
        onClick={openQuickLook}
        transition={spring.smooth}
        aria-label={`Быстрый просмотр: ${release.title}`}
        className="block w-full text-left group"
      >
        <div className="relative aspect-square rounded-md overflow-hidden bg-muted ring-1 ring-white/5 transition-all duration-300 ease-soft group-hover:ring-white/20 group-hover:shadow-xl group-hover:shadow-black/30">
          {release.coverUrl ? (
            <Image src={release.coverUrl} alt={release.title} fill priority={priority} quality={60} sizes="(max-width: 640px) 45vw, 220px" className="object-cover transition-transform duration-500 ease-soft group-hover:scale-[1.04]" />
          ) : (
            <div className="w-full h-full grid place-items-center opacity-20"><NoteIcon /></div>
          )}
          <AnimatePresence>
            {isThisReleasePlaying && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-2 right-2 flex items-end gap-[2px] h-3.5"
                aria-hidden="true"
              >
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-[2.5px] bg-white rounded-full"
                    style={{
                      height: isPlaying ? undefined : '35%',
                      animation: isPlaying ? `vire-eq 0.9s ease-in-out ${i * 0.15}s infinite` : undefined,
                    }}
                  />
                ))}
              </motion.span>
            )}
          </AnimatePresence>
          <span className="absolute inset-0 grid place-items-center bg-black/0 group-hover:bg-black/15 transition-colors">
            <span className="opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-300 ease-soft grid place-items-center w-11 h-11 rounded-full bg-black/55 ring-1 ring-white/30 text-white">
              {isThisReleasePlaying && isPlaying ? <PauseIcon size={13} /> : <PlayIcon size={15} className="translate-x-[1px]" />}
            </span>
          </span>
        </div>
        <div className="mt-2.5 space-y-0.5">
          <p className="text-sm font-medium leading-snug group-hover:text-foreground transition-colors flex items-center gap-1.5 min-w-0">
            <span className="truncate">{release.title}</span>
            {release.hasExplicit && <ExplicitBadge />}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {showArtist ? release.artistName : release.type}
            <span className="opacity-50 font-mono">{' · '}{showArtist ? (upcoming ? release.type : yr ?? release.type) : (yr ?? '')}</span>
          </p>
        </div>
      </motion.button>

      <QuickLookSheet open={open} onClose={() => setOpen(false)}>
        <QuickLookDragHandle className="px-5 pb-3 flex items-center gap-4">
          <motion.div layoutId={layoutId} transition={spring.smooth} className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-muted">
            {release.coverUrl && (
              <Image src={release.coverUrl} alt={release.title} fill sizes="80px" className="object-cover" />
            )}
          </motion.div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold leading-tight truncate">{release.title}</h3>
            {/* stopPropagation — иначе тап ловит onPointerDown QuickLookDragHandle и стартует drag */}
            <Link
              href={`/artists/${release.artistSlug}`}
              onPointerDown={(e) => e.stopPropagation()}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors truncate block"
            >
              {release.artistName}
            </Link>
            <p className="text-[11px] font-mono opacity-40 mt-0.5">{release.type}{yr ? ` · ${yr}` : ''}</p>
          </div>
        </QuickLookDragHandle>

        <div className="px-5 pb-3 flex items-center gap-3">
          <motion.button
            type="button"
            onClick={() => { if (isThisReleasePlaying) controls.togglePlay(); else void playAll(); }}
            whileTap={{ scale: 0.96 }}
            transition={spring.snappy}
            disabled={!tracks || !hasReadyTrack}
            className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
          >
            {isThisReleasePlaying && isPlaying ? <PauseIcon size={13} /> : <PlayIcon size={15} className="translate-x-[1px]" />}
            {isThisReleasePlaying ? (isPlaying ? 'Пауза' : 'Продолжить') : 'Слушать'}
          </motion.button>
          <Link href={releaseHref} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            К релизу <Icon name="arrow-right" size={14} />
          </Link>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 pb-3" data-scroll-area>
          {loading && !tracks && (
            <div className="py-8 grid place-items-center">
              <span className="w-6 h-6 border-2 border-white/30 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!loading && !tracks && (
            <p className="py-6 text-center text-sm text-muted-foreground">Не удалось загрузить треки.</p>
          )}
          {tracks && tracks.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Пока нет треков.</p>
          )}
          {tracks && tracks.map((t) => {
            const ready = t.status === 'READY';
            const isCurrent = activeTrack?.id === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => ready && (isCurrent ? controls.togglePlay() : void playFrom(t.id))}
                disabled={!ready}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${ready ? 'hover:bg-white/5 cursor-pointer' : 'opacity-40 cursor-default'} ${isCurrent ? 'bg-white/5' : ''}`}
              >
                <span className="w-5 text-right text-xs font-mono opacity-30 shrink-0">
                  {isCurrent ? <MiniEq animate={isPlaying} /> : t.trackNumber}
                </span>
                <span className="flex-1 truncate text-sm flex items-center gap-1.5" style={isCurrent ? { color: 'var(--artist-accent, hsl(200 80% 65%))' } : undefined}>
                  <span className="truncate">
                    <TrackTitleText title={t.title} version={t.version} feat={featuredNames(t.credits)} />
                  </span>
                  {t.isExplicit && <ExplicitBadge />}
                </span>
                {t.durationSec != null && ready && (
                  <span className="text-xs font-mono opacity-30 shrink-0">{formatDuration(t.durationSec)}</span>
                )}
                {t.status === 'PROCESSING' && <span className="text-[10px] font-mono opacity-30 shrink-0">обработка…</span>}
              </button>
            );
          })}
        </div>
      </QuickLookSheet>
    </>
  );
}

function NoteIcon() {
  return <Icon name="music" size={36} />;
}
