'use client';
import { useState, useCallback } from 'react';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { controls } from '@/components/player/audio-engine';
import { toPlayerTracks } from '@/lib/player/to-player-track';
import { toast } from '@/components/toast';
import type { PlayerTrack } from '@/store/player';
import type { PlaylistWithTracks, PlaylistTrackRow } from '@vire/db';
import { SortablePlaylistRow } from './playlist-track-row';
import { PlaylistAddPanel } from './playlist-add-panel';
import { PlayIcon } from '@/components/icons';
import { Icon } from '@/components/icon';

export function PlaylistView({ playlist, isOwner, emptyTitle = 'Плейлист пуст' }: { playlist: PlaylistWithTracks; isOwner: boolean; emptyTitle?: string }) {
  const [tracks, setTracks] = useState<PlaylistTrackRow[]>(playlist.tracks);
  const [adding, setAdding] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const context = { source: 'playlist' as const, sourceId: playlist.id };
  const queue: PlayerTrack[] = toPlayerTracks(tracks);

  const persistOrder = useCallback(async (ordered: PlaylistTrackRow[], prev: PlaylistTrackRow[]) => {
    const res = await fetch(`/api/v1/playlists/${playlist.id}/tracks`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackIds: ordered.map((t) => t.id) }),
    }).catch(() => null);
    if (!res?.ok) { setTracks(prev); toast.error('Не удалось сохранить порядок'); }
  }, [playlist.id]);

  // updaters must stay pure — StrictMode invokes them twice, double-firing network calls
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const prev = tracks;
    const from = prev.findIndex((t) => t.id === active.id);
    const to = prev.findIndex((t) => t.id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(prev, from, to);
    setTracks(next);
    void persistOrder(next, prev);
  }

  const handleRemove = useCallback((trackId: string) => {
    const prev = tracks;
    setTracks(prev.filter((t) => t.id !== trackId));
    fetch(`/api/v1/playlists/${playlist.id}/tracks/${trackId}`, { method: 'DELETE' })
      .then((r) => { if (!r.ok) { setTracks(prev); toast.error('Не удалось убрать трек'); } })
      .catch(() => { setTracks(prev); toast.error('Не удалось убрать трек'); });
  }, [playlist.id, tracks]);

  const handleAdded = useCallback((t: PlaylistTrackRow) => {
    setTracks((prev) => (prev.some((x) => x.id === t.id) ? prev : [...prev, t]));
  }, []);

  function playAll() { if (queue.length) controls.playQueue(queue, { context }); }
  function shuffle() { if (queue.length) controls.playQueue(queue, { context, shuffle: true }); }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={playAll} disabled={!tracks.length}
          className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-30 transition-opacity">
          <PlayIcon size={15} className="translate-x-[1px]" /> Слушать
        </button>
        <button onClick={shuffle} disabled={!tracks.length}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30">
          <Icon name="shuffle" size={14} /> Перемешать
        </button>
        {isOwner && (
          <button onClick={() => setAdding((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Icon name="plus" size={14} /> Добавить треки
          </button>
        )}
      </div>

      {isOwner && adding && (
        <PlaylistAddPanel
          playlistId={playlist.id}
          onAdded={handleAdded}
          existingIds={tracks.map((t) => t.id)}
          onAddFailed={(trackId) => setTracks((prev) => prev.filter((t) => t.id !== trackId))}
        />
      )}

      {tracks.length === 0 ? (
        <div className="py-16 text-center space-y-2">
          <p className="text-muted-foreground text-sm">{emptyTitle}</p>
          {isOwner && <p className="text-xs text-muted-foreground opacity-60">Нажми «Добавить треки» и найди что-нибудь</p>}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragEnd={handleDragEnd}>
          <SortableContext items={tracks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col">
              {tracks.map((track, i) => (
                <SortablePlaylistRow key={track.id} track={track} index={i} queue={queue} queueIndex={i} context={context} isOwner={isOwner} onRemove={handleRemove} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

