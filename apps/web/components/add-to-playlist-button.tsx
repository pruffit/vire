'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { Icon } from '@/components/icon';

interface PlaylistItem {
  id: string;
  title: string;
  trackCount: number;
}

interface Props {
  trackId: string;
  /** Вариант: platform (нейтральный) или artist (с artist-токенами) */
  variant?: 'platform' | 'artist';
}

export function AddToPlaylistButton({ trackId, variant = 'platform' }: Props) {
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [inPlaylists, setInPlaylists] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

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
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  function togglePlaylist(playlistId: string, title: string) {
    const adding = !inPlaylists.has(playlistId);

    // Оптимистично: галочка меняется сразу, при ошибке откатываем
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
        toast.error(adding ? 'Не удалось добавить в плейлист' : 'Не удалось убрать из плейлиста');
      } else if (adding) {
        toast(`Добавлено в «${title}»`);
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
        toast.error('Не удалось создать плейлист');
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
        toast(`Добавлено в «${title}»`);
      } else {
        toast.error('Плейлист создан, но трек добавить не удалось');
      }
      setNewTitle('');
      setCreating(false);
    });
  }

  return (
    <div ref={ref} className="relative">
      <motion.button
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.08 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        onClick={() => setOpen((v) => !v)}
        aria-label="Добавить в плейлист"
        title="Добавить в плейлист"
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center transition-opacity',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          variant === 'artist'
            ? 'border border-[color-mix(in_oklch,var(--artist-accent)_35%,transparent)] opacity-50 hover:opacity-80'
            : 'border border-border opacity-50 hover:opacity-80',
        )}
      >
        <PlusIcon />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            // max-w по ширине экрана — на мобилке поповер не вылезает за вьюпорт
            className="absolute left-0 top-full mt-2 w-56 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="px-3 pt-3 pb-1">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Плейлисты
              </p>
            </div>

            {playlists.length === 0 && !creating && (
              <div className="px-3 py-3 text-xs text-muted-foreground">
                Нет плейлистов
              </div>
            )}

            <div className="max-h-40 overflow-y-auto">
              {playlists.map((p) => {
                const inIt = inPlaylists.has(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePlaylist(p.id, p.title)}
                    disabled={isPending}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors',
                      'hover:bg-secondary disabled:opacity-50',
                      inIt ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors',
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

            <div className="border-t border-border">
              {creating ? (
                <div className="flex items-center gap-1 p-2">
                  <input
                    autoFocus
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
                    placeholder="Название…"
                    className="flex-1 text-xs bg-transparent border-b border-border px-1 py-1 outline-none text-foreground placeholder:text-muted-foreground"
                  />
                  <button
                    onClick={handleCreate}
                    disabled={!newTitle.trim() || isPending}
                    className="text-xs font-medium px-2 py-1 rounded hover:bg-secondary disabled:opacity-40 transition-colors"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <Icon name="plus" size={14} />
                  Новый плейлист
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlusIcon() {
  return <Icon name="plus" size={14} />;
}
