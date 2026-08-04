'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { getAllTracks, type OfflineTrack } from '@/lib/offline/db';
import { removeDownload, estimateUsage } from '@/lib/offline/download';
import { useOfflineStore, useOfflineCover } from '@/store/offline';
import { controls } from '@/lib/player/audio-engine';
import { useTrackPlayState } from '@/lib/player/use-play';
import { TrackRow } from '@/components/track-row';
import { EmptyState, Badge } from '@/components/ui-kit';
import { Icon } from '@/components/icon';
import { touchTargetClass } from '@/components/popover';
import { toast } from '@/lib/toast';
import { formatDuration } from '@/lib/format';
import type { PlayerTrack } from '@/store/player';

function formatBytes(n: number): string {
  const mb = n / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} МБ`;
  return `${(mb / 1024).toFixed(1)} ГБ`;
}

function toPlayerTrack(t: OfflineTrack): PlayerTrack {
  return {
    id: t.id,
    title: t.title,
    artistName: t.artistName,
    // Исходный URL, не blob: очередь плеера персистится, а object URL после перезагрузки мёртв —
    // локальную копию подставляет useOfflineCover уже на рендере.
    coverUrl: t.coverUrl,
    artistSlug: t.artistSlug,
    releaseId: t.releaseId,
    isExplicit: t.isExplicit,
    version: t.version,
  };
}

function subscribeOnline(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}
function getOnlineSnapshot(): boolean {
  return navigator.onLine;
}
function getOnlineServerSnapshot(): boolean {
  return true;
}

/** useSyncExternalStore, не useState+эффект — как useIsDesktopPointer: SSR отдаёт «онлайн»,
 *  клиент перепроверяет без рассинхрона гидрации. */
function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getOnlineServerSnapshot);
}

async function resetAppCache(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration().catch(() => undefined);
  reg?.active?.postMessage({ type: 'PURGE_ALL' });
  await reg?.unregister().catch(() => {});
  window.location.reload();
}

export function OfflineScreen() {
  const [tracks, setTracks] = useState<OfflineTrack[] | null>(null);
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [resetConfirming, setResetConfirming] = useState(false);
  const online = useOnlineStatus();

  const refresh = useCallback(() => {
    getAllTracks()
      .then((all) => setTracks(all.filter((t) => t.status === 'done' || t.status === 'partial')))
      .catch(() => setTracks([]));
    estimateUsage().then(setUsage);
  }, []);

  useEffect(() => {
    void useOfflineStore.getState().hydrate().catch(() => {});
    refresh();
  }, [refresh]);

  async function handleRemove(id: string) {
    const prev = tracks;
    setTracks((t) => (t ? t.filter((x) => x.id !== id) : t));
    try {
      await removeDownload(id);
      useOfflineStore.setState((s) => {
        const entries = new Map(s.entries);
        entries.delete(id);
        const covers = new Map(s.covers);
        covers.delete(id);
        return { entries, covers };
      });
      estimateUsage().then(setUsage);
    } catch {
      setTracks(prev);
      toast.error('Не удалось удалить офлайн-копию');
    }
  }

  const queue = (tracks ?? []).map(toPlayerTrack);

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Скачанное</h1>
          <p className="mt-1 text-sm text-foreground/50">
            Треки, доступные без интернета{tracks && tracks.length > 0 ? ` · ${tracks.length}` : ''}
          </p>
        </div>
        {!online && (
          <Badge tone="warn" dot>Нет сети</Badge>
        )}
      </header>

      {tracks === null ? (
        <p className="text-sm text-foreground/40">Загрузка…</p>
      ) : tracks.length === 0 ? (
        <EmptyState
          title="Пока нет скачанного"
          hint="Сохрани трек офлайн через меню очереди или скачай целый плейлист."
        />
      ) : (
        <div className="flex flex-col">
          {tracks.map((t, i) => (
            <OfflineTrackRow
              key={t.id}
              track={t}
              queue={queue}
              index={i}
              onRemove={() => void handleRemove(t.id)}
            />
          ))}
        </div>
      )}

      <div className="pt-8 border-t border-foreground/10">
        {!resetConfirming ? (
          <button
            type="button"
            onClick={() => setResetConfirming(true)}
            className="text-xs text-foreground/30 hover:text-foreground/50 transition-colors pointer-coarse:min-h-11 pointer-coarse:inline-flex pointer-coarse:items-center"
          >
            Сбросить кэш приложения
            {/* storage.estimate() меряет весь origin (оболочка, статика, картинки), а не треки. */}
            {usage && usage.usage > 0 && ` · сейчас ${formatBytes(usage.usage)}`}
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-foreground/50">
              Удалит скачанные треки и офлайн-оболочку приложения. <span className="text-red-400/70">Необратимо.</span>
            </span>
            <button
              type="button"
              onClick={() => void resetAppCache()}
              className="text-xs px-2.5 py-1 rounded-md bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors pointer-coarse:min-h-11 pointer-coarse:inline-flex pointer-coarse:items-center"
            >
              Да, сбросить
            </button>
            <button
              type="button"
              onClick={() => setResetConfirming(false)}
              className="text-xs text-foreground/40 hover:text-foreground/70 transition-colors pointer-coarse:min-h-11 pointer-coarse:inline-flex pointer-coarse:items-center"
            >
              Отмена
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function OfflineTrackRow({
  track, queue, index, onRemove,
}: {
  track: OfflineTrack;
  queue: PlayerTrack[];
  index: number;
  onRemove: () => void;
}) {
  const { isActive, isPlaying } = useTrackPlayState(track.id);
  const coverUrl = useOfflineCover(track.id, track.coverUrl);

  function handlePlay() {
    if (isActive) controls.toggle(track.id);
    else controls.playQueue(queue, { startIndex: index, context: { source: 'direct' } });
  }

  return (
    <TrackRow
      track={{ ...track, coverUrl }}
      isActive={isActive}
      isPlaying={isPlaying}
      onPlay={handlePlay}
      unoptimizedCover
      trailing={
        <>
          {track.status === 'partial' && <Badge tone="warn">неполно</Badge>}
          {track.durationSec != null && (
            <span className="shrink-0 hidden sm:block text-xs font-mono tabular-nums text-muted-foreground">
              {formatDuration(track.durationSec)}
            </span>
          )}
          <span className="shrink-0 hidden sm:block text-xs font-mono tabular-nums text-muted-foreground">
            {formatBytes(track.bytes)}
          </span>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Удалить из офлайна"
            className={`${touchTargetClass('sm')} rounded-full flex items-center justify-center text-muted-foreground hover:text-red-400 transition-colors cursor-pointer`}
          >
            <Icon name="trash-2" size={15} />
          </button>
        </>
      }
    />
  );
}
