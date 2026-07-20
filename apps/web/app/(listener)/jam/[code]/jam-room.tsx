'use client';
import { useCallback, useMemo, useState } from 'react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, TouchSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import type { JamParticipantRole, SearchTrack } from '@vire/core';
import { useJamRoom } from '@/lib/jam/use-jam-room';
import { useJamQueue } from '@/lib/jam/use-jam-queue';
import { useServerClock } from '@/lib/jam/server-clock';
import { usePlaybackSync } from '@/lib/jam/use-playback-sync';
import { getSessionId } from '@/lib/session-id';
import { toast } from '@/lib/toast';
import { controls } from '@/lib/player/audio-engine';
import { SortableTrackRow } from '@/components/sortable-track-row';
import { JamShare } from '@/components/jam-share';
import { JamInvite } from '@/components/jam-invite';
import { JamParticipants } from './jam-participants';
import { JamAddPanel } from './jam-add-panel';
import { JamJoin } from './jam-join';
import { JamSavePlaylist } from './jam-save-playlist';
import { Icon } from '@/components/icon';
import { EmptyState } from '@/components/ui-kit';
import { LivePulse } from '@/components/live-pulse';

interface Props {
  code: string;
  title: string | null;
  hostDisplayName: string;
  initialEnded: boolean;
  isLoggedIn: boolean;
  currentUserName: string | null;
}

interface Membership {
  participantId: string;
  role: JamParticipantRole;
  sessionId: string | null;
}

interface JoinResponse {
  participant: { id: string; role: JamParticipantRole };
}

export function JamRoom({ code, title, hostDisplayName, initialEnded, isLoggedIn, currentUserName }: Props) {
  const [membership, setMembership] = useState<Membership | null>(null);
  const [pending, setPending] = useState(false);
  const [adding, setAdding] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);

  const room = useJamRoom(code, membership?.sessionId ?? null);
  const jamQueue = useJamQueue({
    code,
    sessionId: membership?.sessionId ?? null,
    serverQueue: room.queue,
    setDragging: room.setDragging,
  });
  const { serverNow } = useServerClock();

  const ended = initialEnded || room.ended;
  const isHost = membership?.role === 'HOST';

  const handleTrackEnded = useCallback(() => {
    if (!isHost) return;
    const currentTrackId = room.playback?.trackId;
    const currentIndex = jamQueue.queue.findIndex((item) => item.trackId === currentTrackId);
    const next = currentIndex >= 0 ? jamQueue.queue[currentIndex + 1] : undefined;
    if (!next) return;
    void fetch(`/api/v1/jam/${encodeURIComponent(code)}/playback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'track', trackId: next.trackId }),
    }).catch(() => {});
  }, [isHost, room.playback, jamQueue.queue, code]);

  usePlaybackSync({ playback: room.playback, serverNow, audioEnabled, onEnded: handleTrackEnded });

  const handleJoin = useCallback(async (displayName: string) => {
    setPending(true);
    try {
      const sessionId = isLoggedIn ? null : await getSessionId();
      const res = await fetch(`/api/v1/jam/${encodeURIComponent(code)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: isLoggedIn ? (currentUserName ?? 'Я') : displayName,
          ...(sessionId ? { sessionId } : {}),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as JoinResponse;
      setMembership({ participantId: data.participant.id, role: data.participant.role, sessionId });
      // Два аудио одновременно недопустимы — вход в звук джема глушит глобальный плеер.
      controls.pause();
      setAudioEnabled(true);
    } catch {
      toast.error('Не удалось подключиться к джему');
    } finally {
      setPending(false);
    }
  }, [code, isLoggedIn, currentUserName]);

  const noop = useCallback(() => {}, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const participantsById = useMemo(
    () => new Map(room.participants.map((p) => [p.id, p.displayName])),
    [room.participants],
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) {
      jamQueue.cancelDrag();
      return;
    }
    void jamQueue.moveTrack(String(active.id), String(over.id));
  }

  async function handleEndJam() {
    if (!confirm('Завершить джем для всех?')) return;
    const res = await fetch(`/api/v1/jam/${encodeURIComponent(code)}/end`, { method: 'POST' }).catch(() => null);
    if (!res?.ok) toast.error('Не удалось завершить джем');
  }

  function handleAdd(t: SearchTrack) {
    void jamQueue.addTrack({
      id: `pending-${t.id}-${Date.now()}`,
      trackId: t.id,
      position: jamQueue.queue.length,
      addedByParticipantId: membership?.participantId ?? null,
      addedAt: new Date(),
      title: t.title,
      durationSec: null,
      artistName: t.artistName,
      artistSlug: t.artistSlug,
      releaseId: t.releaseId,
      coverUrl: t.coverUrl,
      accentColor: null,
      isExplicit: false,
      version: t.version,
      feat: t.feat,
    });
  }

  if (!membership) {
    return (
      <JamJoin
        title={title}
        hostDisplayName={hostDisplayName}
        ended={ended}
        isLoggedIn={isLoggedIn}
        pending={pending}
        onJoin={handleJoin}
      />
    );
  }

  if (ended) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-6 py-24 text-center">
        <p className="text-2xl font-semibold tracking-tight">Джем завершён</p>
        <p className="mt-3 text-sm text-muted-foreground">Спасибо, что заглянули.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-border/40 px-4 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {room.connected && <LivePulse small className="text-primary" />}
              {room.connected ? 'В сети' : 'Подключение…'}
            </p>
            <h1 className="mt-1 truncate text-xl font-semibold tracking-tight">{title ?? 'Джем-сессия'}</h1>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums tracking-[0.15em]">{code}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <JamParticipants participants={room.participants} />
            {isLoggedIn && <JamInvite code={code} />}
            {isLoggedIn && <JamSavePlaylist code={code} />}
            <JamShare code={code} title={title} />
          </div>
        </div>
        {isHost && (
          <button
            onClick={() => void handleEndJam()}
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <Icon name="log-out" size={12} /> Завершить джем
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-4">
        <button
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icon name="plus" size={14} /> Добавить трек
        </button>

        {adding && <JamAddPanel onAdd={handleAdd} />}

        {jamQueue.queue.length === 0 ? (
          <EmptyState title="Очередь пуста" hint="Добавьте первый трек, чтобы начать" />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            onDragStart={jamQueue.startDrag}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={jamQueue.queue.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col">
                {jamQueue.queue.map((item, i) => {
                  const addedByName = item.addedByParticipantId ? participantsById.get(item.addedByParticipantId) : undefined;
                  return (
                    <SortableTrackRow
                      key={item.id}
                      track={item}
                      index={i}
                      isActive={room.playback?.trackId === item.trackId}
                      isPlaying={Boolean(room.playback && room.playback.trackId === item.trackId && !room.playback.paused)}
                      onPlay={noop}
                      canDrag
                      canRemove={isHost || item.addedByParticipantId === membership.participantId}
                      onRemove={(id) => void jamQueue.removeTrack(id)}
                      removeLabel="Убрать из очереди"
                      subtitle={
                        <span className="truncate">
                          {item.artistName}
                          {addedByName && <> · Добавил(а) {addedByName}</>}
                        </span>
                      }
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {!isHost && (
        <div className="shrink-0 border-t border-border/40 px-4 py-2.5 text-center text-xs text-muted-foreground">
          Воспроизведением управляет хост
        </div>
      )}
    </div>
  );
}
