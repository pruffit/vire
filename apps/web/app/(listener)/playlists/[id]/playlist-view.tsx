'use client';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { useRouter } from 'next/navigation';
import { controls } from '@/lib/player/audio-engine';
import { toPlayerTracks } from '@/lib/player/to-player-track';
import { toast } from '@/lib/toast';
import type { PlayerTrack } from '@/store/player';
import type { PlaylistWithTracks, PlaylistTrackRow } from '@vire/db';
import { SortablePlaylistRow } from './playlist-track-row';
import { PlaylistAddPanel } from './playlist-add-panel';
import { PlaylistRealtimeSync } from './playlist-realtime-sync';
import { PlaylistDownloadButton } from './playlist-download-button';
import { PlayIcon } from '@/components/icons';
import { Icon } from '@/components/icon';

export type PlaylistViewerRole = 'OWNER' | 'COLLABORATOR' | 'VIEWER';

interface Props {
  playlist: PlaylistWithTracks;
  role: PlaylistViewerRole;
  viewerId?: string | null;
  emptyTitle?: string;
}

export function PlaylistView({ playlist, role, viewerId = null, emptyTitle = 'Плейлист пуст' }: Props) {
  const [tracks, setTracks] = useState<PlaylistTrackRow[]>(playlist.tracks);
  const [version, setVersion] = useState(playlist.version);
  const [adding, setAdding] = useState(false);
  const router = useRouter();

  const canEdit = role === 'OWNER' || role === 'COLLABORATOR';
  const isLiveSynced = playlist.isCollaborative && canEdit;

  const versionRef = useRef(version);
  useLayoutEffect(() => {
    versionRef.current = version;
  }, [version]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const context = { source: 'playlist' as const, sourceId: playlist.id };
  const queue: PlayerTrack[] = toPlayerTracks(tracks);

  const refetchTracks = useCallback(async () => {
    const res = await fetch(`/api/v1/playlists/${playlist.id}/tracks`).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { tracks: PlaylistTrackRow[]; version: number };
    if (data.version <= versionRef.current) return;
    setTracks(data.tracks);
    setVersion(data.version);
  }, [playlist.id]);

  const persistOrder = useCallback(async (ordered: PlaylistTrackRow[], prev: PlaylistTrackRow[]) => {
    const res = await fetch(`/api/v1/playlists/${playlist.id}/tracks`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackIds: ordered.map((t) => t.id) }),
    }).catch(() => null);
    if (res?.ok) return;
    if (res?.status === 409) { void refetchTracks(); return; }
    setTracks(prev);
    toast.error('Не удалось сохранить порядок');
  }, [playlist.id, refetchTracks]);

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

  function canRemoveTrack(track: PlaylistTrackRow): boolean {
    if (role === 'OWNER') return true;
    if (role === 'COLLABORATOR') return track.addedBy?.id === viewerId;
    return false;
  }

  function playAll() { if (queue.length) controls.playQueue(queue, { context }); }
  function shuffle() { if (queue.length) controls.playQueue(queue, { context, shuffle: true }); }

  return (
    <div className="space-y-6">
      {isLiveSynced && viewerId && (
        <PlaylistRealtimeSync
          playlistId={playlist.id}
          selfUserId={viewerId}
          version={version}
          onTracksChanged={() => void refetchTracks()}
          onCollaboratorsChanged={() => router.refresh()}
        />
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={playAll} disabled={!tracks.length}
          className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-30 transition-opacity">
          <PlayIcon size={15} className="translate-x-[1px]" /> Слушать
        </button>
        <button onClick={shuffle} disabled={!tracks.length}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30">
          <Icon name="shuffle" size={14} /> Перемешать
        </button>
        {canEdit && (
          <button onClick={() => setAdding((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Icon name="plus" size={14} /> Добавить треки
          </button>
        )}
        <PlaylistDownloadButton tracks={queue} />
      </div>

      {canEdit && adding && (
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
          {canEdit && <p className="text-xs text-muted-foreground opacity-60">Нажми «Добавить треки» и найди что-нибудь</p>}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragEnd={handleDragEnd}>
          <SortableContext items={tracks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col">
              {tracks.map((track, i) => (
                <SortablePlaylistRow
                  key={track.id}
                  track={track}
                  index={i}
                  queue={queue}
                  queueIndex={i}
                  context={context}
                  canDrag={canEdit}
                  canRemove={canRemoveTrack(track)}
                  showAddedBy={playlist.isCollaborative}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
