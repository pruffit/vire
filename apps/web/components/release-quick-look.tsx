'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { controls } from '@/components/player/audio-engine';
import { usePlayerStore, type PlayerTrack } from '@/store/player';
import { PlayIcon, PauseIcon } from '@/components/icons';
import { ExplicitBadge } from '@/components/explicit-badge';
import { formatDuration } from '@/lib/format';
import { Icon } from '@/components/icon';

export interface QuickLookRelease {
  id: string;
  title: string;
  coverUrl: string | null;
  type: string;
  artistName: string;
  artistSlug: string;
  releaseDate: Date | string | null;
}

interface QLTrack {
  id: string;
  title: string;
  trackNumber: number;
  durationSec: number | null;
  status: 'PROCESSING' | 'READY' | 'BLOCKED';
  isExplicit?: boolean;
}

function year(d: Date | string | null): string | null {
  if (!d) return null;
  const y = new Date(d).getFullYear();
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
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

/**
 * Карточка релиза, которая по клику разворачивается в оверлей-«peek» с трек-листом
 * и кнопкой play — без перехода на страницу. Эталонный приём: shared-element
 * обложки (layoutId), blur-фон, drag/click/Esc для закрытия. Трек-лист
 * подгружается лениво из /api/v1/releases/[id].
 */
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
  const [tracks, setTracks] = useState<QLTrack[] | null>(null);
  const [loading, setLoading] = useState(false);
  const layoutId = useId();
  const yr = year(release.releaseDate);
  const releaseHref = `/artists/${release.artistSlug}/releases/${release.id}`;

  const activeTrack = usePlayerStore((s) => s.track);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isThisReleasePlaying = activeTrack?.releaseId === release.id;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Невышедший релиз нельзя слушать: карточка ведёт на страницу с обратным
  // отсчётом, без peek-оверлея и плеера. (Возврат после всех хуков — правило hooks.)
  if (upcoming) {
    return (
      <Link href={releaseHref} className="block w-full text-left group" aria-label={`${release.title} — скоро`}>
        <div className="relative aspect-square rounded-md overflow-hidden bg-muted ring-1 ring-white/5 transition-all duration-300 ease-soft group-hover:ring-white/20 group-hover:shadow-xl group-hover:shadow-black/30">
          {release.coverUrl ? (
            <Image src={release.coverUrl} alt={release.title} fill priority={priority} sizes="(max-width: 640px) 50vw, 250px" className="object-cover transition-transform duration-500 ease-soft group-hover:scale-[1.04]" />
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
          <p className="text-sm font-medium leading-snug truncate group-hover:text-foreground transition-colors">{release.title}</p>
          <p className="text-xs text-muted-foreground truncate">
            {showArtist ? release.artistName : release.type}
            <span className="opacity-50 font-mono">{' · '}{release.type}</span>
          </p>
        </div>
      </Link>
    );
  }

  function loadTracks() {
    if (tracks || loading) return;
    setLoading(true);
    fetch(`/api/v1/releases/${release.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { tracks?: QLTrack[] } | null) => setTracks(d?.tracks ?? []))
      .catch(() => setTracks([]))
      .finally(() => setLoading(false));
  }

  function openQuickLook() {
    setOpen(true);
    loadTracks();
  }


  function readyQueue(): PlayerTrack[] {
    return (tracks ?? [])
      .filter((t) => t.status === 'READY')
      .map((t) => ({
        id: t.id,
        title: t.title,
        artistName: release.artistName,
        coverUrl: release.coverUrl,
        artistSlug: release.artistSlug,
        releaseId: release.id,
        isExplicit: t.isExplicit,
      }));
  }

  function playFrom(trackId: string) {
    const queue = readyQueue();
    const idx = Math.max(0, queue.findIndex((q) => q.id === trackId));
    if (queue[idx]) controls.play(queue[idx], queue, idx);
  }

  function playAll() {
    const queue = readyQueue();
    if (queue[0]) controls.play(queue[0], queue, 0);
  }

  function onDragEnd(_e: unknown, info: PanInfo) {
    if (info.offset.y > 120 || info.velocity.y > 600) setOpen(false);
  }

  return (
    <>
      {/* Карточка */}
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
            <Image src={release.coverUrl} alt={release.title} fill priority={priority} sizes="(max-width: 640px) 50vw, 250px" className="object-cover transition-transform duration-500 ease-soft group-hover:scale-[1.04]" />
          ) : (
            <div className="w-full h-full grid place-items-center opacity-20"><NoteIcon /></div>
          )}
          {upcoming && release.releaseDate && (
            <span className="absolute top-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-mono text-white/90">
              {untilLabel(release.releaseDate) ?? release.type}
            </span>
          )}
          {/* Now-playing индикатор поверх обложки */}
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
                <style>{`@keyframes vire-eq { 0%,100% { height: 30%; } 50% { height: 100%; } }`}</style>
              </motion.span>
            )}
          </AnimatePresence>
          {/* Play/pause-подсказка на ховере */}
          <span className="absolute inset-0 grid place-items-center bg-black/0 group-hover:bg-black/15 transition-colors">
            <span className="opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-300 ease-soft grid place-items-center w-11 h-11 rounded-full bg-black/55 backdrop-blur-md ring-1 ring-white/30 text-white">
              {isThisReleasePlaying && isPlaying ? <PauseIcon size={13} /> : <PlayIcon size={15} className="translate-x-[1px]" />}
            </span>
          </span>
        </div>
        <div className="mt-2.5 space-y-0.5">
          <p className="text-sm font-medium leading-snug truncate group-hover:text-foreground transition-colors">{release.title}</p>
          <p className="text-xs text-muted-foreground truncate">
            {showArtist ? release.artistName : release.type}
            <span className="opacity-50 font-mono">{' · '}{showArtist ? (upcoming ? release.type : yr ?? release.type) : (yr ?? '')}</span>
          </p>
        </div>
      </motion.button>

      {/* Оверлей */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[60] grid place-items-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl"
            style={{ paddingBottom: activeTrack ? 'calc(64px + 1.5rem)' : undefined }}
          >
            <motion.div
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={onDragEnd}
              onClick={(e) => e.stopPropagation()}
              transition={spring.smooth}
              className="w-full max-w-md max-h-[88vh] flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden cursor-default"
            >
              {/* «хваталка» */}
              <div className="pt-2.5 pb-1 flex justify-center cursor-grab active:cursor-grabbing">
                <span className="w-10 h-1 rounded-full bg-white/15" />
              </div>

              <div className="px-5 pb-3 flex items-center gap-4">
                <motion.div layoutId={layoutId} transition={spring.smooth} className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-muted">
                  {release.coverUrl && (
                    <Image src={release.coverUrl} alt={release.title} fill sizes="80px" className="object-cover" />
                  )}
                </motion.div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold leading-tight truncate">{release.title}</h3>
                  <Link href={`/artists/${release.artistSlug}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors truncate block">
                    {release.artistName}
                  </Link>
                  <p className="text-[11px] font-mono opacity-40 mt-0.5">{release.type}{yr ? ` · ${yr}` : ''}</p>
                </div>
              </div>

              <div className="px-5 pb-3 flex items-center gap-3">
                <motion.button
                  type="button"
                  onClick={isThisReleasePlaying ? () => controls.togglePlay() : playAll}
                  whileTap={{ scale: 0.96 }}
                  transition={spring.snappy}
                  disabled={!tracks || readyQueue().length === 0}
                  className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
                >
                  {isThisReleasePlaying && isPlaying ? <PauseIcon size={13} /> : <PlayIcon size={15} className="translate-x-[1px]" />}
                  {isThisReleasePlaying ? (isPlaying ? 'Пауза' : 'Продолжить') : 'Слушать'}
                </motion.button>
                <Link href={releaseHref} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  К релизу →
                </Link>
              </div>

              {/* Трек-лист */}
              <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3" data-scroll-area>
                {loading && !tracks && (
                  <div className="py-8 grid place-items-center">
                    <span className="w-6 h-6 border-2 border-white/30 border-t-transparent rounded-full animate-spin" />
                  </div>
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
                      onClick={() => ready && (isCurrent ? controls.togglePlay() : playFrom(t.id))}
                      disabled={!ready}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${ready ? 'hover:bg-white/5 cursor-pointer' : 'opacity-40 cursor-default'} ${isCurrent ? 'bg-white/5' : ''}`}
                    >
                      <span className="w-5 text-right text-xs font-mono opacity-30 shrink-0">
                        {isCurrent ? <MiniEq animate={isPlaying} /> : t.trackNumber}
                      </span>
                      <span className="flex-1 truncate text-sm flex items-center gap-1.5" style={isCurrent ? { color: 'var(--artist-accent, hsl(200 80% 65%))' } : undefined}>
                        <span className="truncate">{t.title}</span>
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function NoteIcon() {
  return <Icon name="music" size={36} />;
}
function MiniEq({ animate }: { animate: boolean }) {
  return (
    <span className="inline-flex items-end gap-[1.5px] h-3" style={{ color: 'var(--artist-accent, hsl(200 80% 65%))' }} aria-label="Сейчас играет">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[2px] bg-current rounded-full"
          style={{
            height: animate ? undefined : '35%',
            animation: animate ? `vire-eq 0.9s ease-in-out ${i * 0.15}s infinite` : undefined,
          }}
        />
      ))}
    </span>
  );
}
