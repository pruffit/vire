'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { Icon } from '@/components/icon';
import { touchTargetClass } from '@/components/popover';
import { Sheet } from '@/components/sheet';
import { useIsDesktopPointer } from '@/lib/is-desktop-pointer';
import { useViewportClampX } from '@/lib/use-viewport-clamp-x';

interface PlaylistItem {
  id: string;
  title: string;
  trackCount: number;
}

interface Props {
  trackId: string;
  variant?: 'platform' | 'artist';
}

export function AddToPlaylistButton({ trackId, variant = 'platform' }: Props) {
  const t = useTranslations('playlist');
  const desktop = useIsDesktopPointer();
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [inPlaylists, setInPlaylists] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { panelRef, offsetX } = useViewportClampX(open);

  useEffect(() => {
    if (!open) return;

    const ctrl = new AbortController();
    fetch(`/api/v1/playlists?trackId=${trackId}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => {
        if (data.playlists) setPlaylists(data.playlists);
        if (data.inPlaylists) setInPlaylists(new Set<string>(data.inPlaylists));
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [open, trackId]);

  useEffect(() => {
    // Sheet ловит overlay-click/esc сам — вешать mousedown только для десктоп-поповера
    if (!open || !desktop) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open, desktop]);

  function togglePlaylist(playlistId: string, title: string) {
    const adding = !inPlaylists.has(playlistId);

    setInPlaylists((prev) => {
      const next = new Set(prev);
      if (adding) next.add(playlistId); else next.delete(playlistId);
      return next;
    });

    startTransition(async () => {
      const res = await (adding
        ? fetch(`/api/v1/playlists/${playlistId}/tracks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trackId }),
          })
        : fetch(`/api/v1/playlists/${playlistId}/tracks/${trackId}`, { method: 'DELETE' })
      ).catch(() => null);

      if (!res?.ok) {
        setInPlaylists((prev) => {
          const next = new Set(prev);
          if (adding) next.delete(playlistId); else next.add(playlistId);
          return next;
        });
        toast.error(adding ? t('addButton.addFailed') : t('addButton.removeFailed'));
      } else if (adding) {
        toast(t('addButton.added', { title }));
      }
    });
  }

  function handleCreate() {
    if (!newTitle.trim()) return;
    startTransition(async () => {
      const title = newTitle.trim();
      const res = await fetch('/api/v1/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      }).catch(() => null);
      const data = res?.ok ? await res.json() : null;
      if (!data?.id) {
        toast.error(t('addButton.createFailed'));
        return;
      }

      const newPl: PlaylistItem = { id: data.id, title, trackCount: 0 };
      setPlaylists((prev) => [newPl, ...prev]);

      const added = await fetch(`/api/v1/playlists/${data.id}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId }),
      }).catch(() => null);
      if (added?.ok) {
        setInPlaylists((prev) => new Set([...prev, data.id]));
        toast(t('addButton.added', { title }));
      } else {
        toast.error(t('addButton.createdButAddFailed'));
      }
      setNewTitle('');
      setCreating(false);
    });
  }

  const panelContent = (dense: boolean) => (
    <>
      {playlists.length === 0 && !creating && (
        <div className={cn('text-muted-foreground', dense ? 'px-4 py-3 text-sm' : 'px-3 py-3 text-xs')}>
          {t('addButton.empty')}
        </div>
      )}

      <div className={dense ? 'flex-1 min-h-0 overflow-y-auto overflow-x-clip' : 'max-h-40 overflow-y-auto overflow-x-clip'}>
        {playlists.map((p) => {
          const inIt = inPlaylists.has(p.id);
          return (
            <button
              key={p.id}
              onClick={() => togglePlaylist(p.id, p.title)}
              disabled={isPending}
              className={cn(
                'w-full flex items-center gap-2.5 text-left transition-colors hover:bg-secondary disabled:opacity-50',
                dense ? 'min-h-11 px-4 text-[15px]' : 'px-3 py-2 text-sm',
                inIt ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'rounded border flex-shrink-0 flex items-center justify-center transition-colors',
                  dense ? 'w-5 h-5' : 'w-4 h-4',
                  inIt ? 'bg-foreground border-foreground' : 'border-border',
                )}
              >
                {inIt && (
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="text-background">
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                )}
              </span>
              <span className="flex-1 truncate">{p.title}</span>
              <span className="text-[10px] font-mono opacity-30">{p.trackCount}</span>
            </button>
          );
        })}
      </div>

      <div className={cn('border-t border-border shrink-0')}>
        {creating ? (
          <div className={cn('flex items-center gap-1', dense ? 'p-3' : 'p-2')}>
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
              placeholder={t('addButton.namePlaceholder')}
              className={cn(
                'flex-1 bg-transparent border-b border-border outline-none text-foreground placeholder:text-muted-foreground',
                dense ? 'text-sm py-2' : 'text-xs py-1 px-1',
              )}
            />
            <button
              onClick={handleCreate}
              disabled={!newTitle.trim() || isPending}
              className={cn(
                'font-medium rounded hover:bg-secondary disabled:opacity-40 transition-colors',
                dense ? 'text-sm px-3 py-2' : 'text-xs px-2 py-1',
              )}
            >
              OK
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className={cn(
              'w-full flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors',
              dense ? 'min-h-11 px-4 text-sm' : 'px-3 py-2.5 text-xs',
            )}
          >
            <Icon name="plus" size={14} />
            {t('addButton.newPlaylist')}
          </button>
        )}
      </div>
    </>
  );

  const triggerButton = (
    <motion.button
      ref={triggerRef}
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.08 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      onClick={() => setOpen((v) => !v)}
      aria-label={t('addButton.aria')}
      title={t('addButton.aria')}
      className={cn(
        touchTargetClass('md'),
        'rounded-full flex items-center justify-center',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <span
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center transition-opacity',
          variant === 'artist'
            ? 'border border-[color-mix(in_oklch,var(--artist-accent)_35%,transparent)] opacity-50 hover:opacity-80'
            : 'border border-border opacity-50 hover:opacity-80',
        )}
      >
        <PlusIcon />
      </span>
    </motion.button>
  );

  if (!desktop) {
    return (
      <div className="relative">
        {triggerButton}
        <Sheet open={open} onClose={() => { setOpen(false); triggerRef.current?.focus(); }} anchor="bottom">
          <p className="shrink-0 px-4 pt-1 pb-2 label-mono text-muted-foreground">
            {t('addButton.heading')}
          </p>
          {panelContent(true)}
        </Sheet>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      {triggerButton}

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -6, scale: 0.96, x: offsetX }}
            animate={{ opacity: 1, y: 0, scale: 1, x: offsetX }}
            exit={{ opacity: 0, y: -4, scale: 0.97, x: offsetX }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            // max-w по ширине экрана — на мобилке поповер не вылезает за вьюпорт
            className="absolute left-0 top-full mt-2 w-56 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="px-3 pt-3 pb-1">
              <p className="label-mono text-[10px] text-muted-foreground">
                {t('addButton.heading')}
              </p>
            </div>

            {panelContent(false)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlusIcon() {
  return <Icon name="plus" size={14} />;
}
