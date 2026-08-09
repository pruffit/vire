'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/icon';
import { useOfflineStore } from '@/store/offline';
import { toDownloadMeta } from '@/lib/offline/to-download-meta';
import type { PlayerTrack } from '@/store/player';

function waitUntilSettled(trackId: string): Promise<void> {
  function settled(): boolean {
    return useOfflineStore.getState().entries.get(trackId)?.status !== 'downloading';
  }
  if (settled()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = useOfflineStore.subscribe(() => {
      if (settled()) {
        unsub();
        resolve();
      }
    });
  });
}

export function PlaylistDownloadButton({ tracks }: { tracks: PlayerTrack[] }) {
  const t = useTranslations('playlist');
  const entries = useOfflineStore((s) => s.entries);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const cancelledRef = useRef(false);
  const currentIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    void useOfflineStore.getState().hydrate().catch(() => {});
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const allDone = tracks.length > 0 && tracks.every((t) => entries.get(t.id)?.status === 'done');

  async function start() {
    cancelledRef.current = false;
    setRunning(true);
    setDone(0);
    let settledCount = 0;
    for (const t of tracks) {
      if (cancelledRef.current) break;
      currentIdRef.current = t.id;
      if (useOfflineStore.getState().entries.get(t.id)?.status !== 'done') {
        useOfflineStore.getState().download(toDownloadMeta(t));
        await waitUntilSettled(t.id);
      }
      settledCount += 1;
      if (mountedRef.current) setDone(settledCount);
    }
    currentIdRef.current = null;
    if (mountedRef.current) setRunning(false);
  }

  function cancel() {
    cancelledRef.current = true;
    if (currentIdRef.current) useOfflineStore.getState().cancel(currentIdRef.current);
  }

  if (tracks.length === 0) return null;

  if (running) {
    return (
      <button
        type="button"
        onClick={cancel}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors pointer-coarse:min-h-11"
      >
        <Icon name="x" size={14} /> {t('download.progress', { done, total: tracks.length })}
      </button>
    );
  }

  if (allDone) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-sm text-foreground/40 pointer-coarse:min-h-11">
        <Icon name="check" size={14} /> {t('download.done')}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void start()}
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors pointer-coarse:min-h-11"
    >
      <Icon name="save" size={14} /> {t('download.cta')}
    </button>
  );
}
