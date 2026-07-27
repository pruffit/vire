'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, TouchSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import Image from 'next/image';
import type { JamParticipantRole, JamQueueItem, SearchTrack } from '@vire/core';
import { derivePositionMs } from '@vire/core';
import { useJamRoom } from '@/lib/jam/use-jam-room';
import { useJamQueue } from '@/lib/jam/use-jam-queue';
import { useServerClock } from '@/lib/jam/server-clock';
import { usePlaybackSync } from '@/lib/jam/use-playback-sync';
import { setJamToggle } from '@/lib/jam/jam-controls';
import { effectivePaused, resolvePending, PENDING_TTL_MS, type PendingToggle } from '@/lib/jam/optimistic-playback';
import { getSessionId } from '@/lib/session-id';
import { toast } from '@/lib/toast';
import { usePlayerStore } from '@/store/player';
import { controls } from '@/lib/player/audio-engine';
import { SortableTrackRow } from '@/components/sortable-track-row';
import { PageContainer } from '@/components/page-container';
import { JamShare } from '@/components/jam-share';
import { JamInvite } from '@/components/jam-invite';
import { JamParticipants } from './jam-participants';
import { JamAddPanel } from './jam-add-panel';
import { JamJoin } from './jam-join';
import { JamSavePlaylist } from './jam-save-playlist';
import { Icon } from '@/components/icon';
import { EmptyState } from '@/components/ui-kit';
import { LivePulse } from '@/components/live-pulse';
import { TrackTitleText } from '@/components/track-title';

interface Props {
  code: string;
  title: string | null;
  hostDisplayName: string;
  initialEnded: boolean;
  isLoggedIn: boolean;
  currentUserName: string | null;
  suggestions: SearchTrack[];
}

type PlaybackCommand =
  | { kind: 'play'; trackId: string; positionMs: number }
  | { kind: 'pause'; positionMs: number }
  | { kind: 'track'; trackId: string };

interface Membership {
  participantId: string;
  role: JamParticipantRole;
  sessionId: string | null;
}

interface JoinResponse {
  participant: { id: string; role: JamParticipantRole };
}

export function JamRoom({ code, title, hostDisplayName, initialEnded, isLoggedIn, currentUserName, suggestions }: Props) {
  const [membership, setMembership] = useState<Membership | null>(null);
  const [pending, setPending] = useState(false);
  const [adding, setAdding] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [playbackPending, setPlaybackPending] = useState<PendingToggle | null>(null);

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

  const postPlayback = useCallback((body: PlaybackCommand, onError?: () => void) => {
    const sessionId = membership?.sessionId;
    fetch(`/api/v1/jam/${encodeURIComponent(code)}/playback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionId ? { ...body, sessionId } : body),
    })
      .then((res) => { if (!res.ok) throw new Error(String(res.status)); })
      .catch(() => {
        toast.error('Не удалось изменить воспроизведение');
        onError?.();
      });
  }, [code, membership?.sessionId]);

  const handleTrackEnded = useCallback(() => {
    if (!isHost) return;
    const currentTrackId = room.playback?.trackId;
    const currentIndex = jamQueue.queue.findIndex((item) => item.trackId === currentTrackId);
    const next = currentIndex >= 0 ? jamQueue.queue[currentIndex + 1] : undefined;
    if (!next) return;
    postPlayback({ kind: 'track', trackId: next.trackId });
  }, [isHost, room.playback, jamQueue.queue, postPlayback]);

  usePlaybackSync({ playback: room.playback, serverNow, audioEnabled: audioEnabled && !ended, onEnded: handleTrackEnded });

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

  const handleRowPlay = useCallback((item: JamQueueItem) => {
    const playback = room.playback;
    if (playback?.trackId === item.trackId) {
      const paused = effectivePaused(playback, playbackPending);
      const next: PendingToggle = { paused: !paused, at: Date.now() };
      postPlayback(
        paused
          ? { kind: 'play', trackId: item.trackId, positionMs: derivePositionMs(playback, serverNow()) }
          : { kind: 'pause', positionMs: derivePositionMs(playback, serverNow()) },
        () => setPlaybackPending((prev) => (prev === next ? null : prev)),
      );
      setPlaybackPending(next);
    } else {
      setPlaybackPending(null);
      postPlayback({ kind: 'track', trackId: item.trackId });
    }
  }, [room.playback, playbackPending, serverNow, postPlayback]);

  const handleTogglePlayback = useCallback(() => {
    const playback = room.playback;
    if (!playback) return;
    const paused = effectivePaused(playback, playbackPending);
    const next: PendingToggle = { paused: !paused, at: Date.now() };
    postPlayback(
      paused
        ? { kind: 'play', trackId: playback.trackId, positionMs: derivePositionMs(playback, serverNow()) }
        : { kind: 'pause', positionMs: derivePositionMs(playback, serverNow()) },
      () => setPlaybackPending((prev) => (prev === next ? null : prev)),
    );
    setPlaybackPending(next);
  }, [room.playback, playbackPending, serverNow, postPlayback]);

  // Снятие pending — адаптация state к изменившемуся входу в рендере (приём syncedId
  // из use-optimistic-toggle.ts): эффект тут запрещён линтером, мутация рефа — React.
  const [resolvedPlayback, setResolvedPlayback] = useState(room.playback);
  if (resolvedPlayback !== room.playback) {
    setResolvedPlayback(room.playback);
    setPlaybackPending((prev) => resolvePending(prev, Boolean(room.playback?.paused), Date.now(), PENDING_TTL_MS));
  }

  // Фолбэк на случай, если SSE-подтверждение не пришло вовсе (обрыв соединения).
  useEffect(() => {
    if (!playbackPending) return;
    const timer = setTimeout(
      () => setPlaybackPending((prev) => (prev === playbackPending ? null : prev)),
      PENDING_TTL_MS,
    );
    return () => clearTimeout(timer);
  }, [playbackPending]);

  const activeTrack = useMemo(
    () => (room.playback ? jamQueue.queue.find((item) => item.trackId === room.playback!.trackId) : undefined),
    [room.playback, jamQueue.queue],
  );
  const isPlaying = Boolean(room.playback) && !effectivePaused(room.playback, playbackPending);

  const setPlayerJamOverride = usePlayerStore((s) => s.setJamOverride);

  // Джем занимает глобальный плеер: пока звук джема играет, mini-bar показывает его трек и толкает handleTogglePlayback.
  // Условие гашения (!audioEnabled || ended) проверяется первым и не зависит от activeTrack —
  // иначе рендер, где playback/очередь ещё не согласовались, мог бы отложить чистку оверлея.
  useEffect(() => {
    if (!audioEnabled || ended) {
      setPlayerJamOverride(null);
      return;
    }
    if (!activeTrack) return;
    setPlayerJamOverride({
      code,
      track: { title: activeTrack.title, artistName: activeTrack.artistName, coverUrl: activeTrack.coverUrl },
      isPlaying,
    });
  }, [audioEnabled, ended, activeTrack, isPlaying, code, setPlayerJamOverride]);

  // Отдельно от основного эффекта — гарантирует чистку при уходе со страницы независимо от того,
  // какая ветка выше сработала последней.
  useEffect(() => () => setPlayerJamOverride(null), [setPlayerJamOverride]);

  useEffect(() => {
    setJamToggle(handleTogglePlayback);
    return () => setJamToggle(null);
  }, [handleTogglePlayback]);

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

  function moveAdjacent(itemId: string, dir: -1 | 1) {
    const i = jamQueue.queue.findIndex((item) => item.id === itemId);
    const neighbor = i < 0 ? undefined : jamQueue.queue[i + dir];
    if (!neighbor) return;
    void jamQueue.moveTrack(itemId, neighbor.id);
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
    <div data-app-screen className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-border/40 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {room.connected && <LivePulse small className="text-primary" />}
              {room.connected ? 'В сети' : 'Подключение…'}
            </p>
            <div className="mt-0.5 flex items-baseline gap-2">
              <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">{title ?? 'Джем-сессия'}</h1>
              <p className="shrink-0 font-mono text-sm font-semibold tabular-nums tracking-[0.12em] text-muted-foreground sm:text-base">
                {code}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <JamParticipants participants={room.participants} />
            {isLoggedIn && <JamInvite code={code} />}
            {isLoggedIn && <JamSavePlaylist code={code} />}
            <JamShare code={code} title={title} />
            {isHost && (
              <button
                type="button"
                onClick={() => void handleEndJam()}
                aria-label="Завершить джем"
                className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-sm text-muted-foreground hover:text-destructive transition-colors sm:px-4"
              >
                <Icon name="log-out" size={14} />
                <span className="hidden sm:inline">Завершить джем</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <PageContainer as="div" variant="compact">
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6">
            <div className="min-w-0 space-y-4">
              {activeTrack && (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-card/50 px-3 py-2.5">
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                    {activeTrack.coverUrl && (
                      <Image src={activeTrack.coverUrl} alt="" fill sizes="48px" className="object-cover" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-primary">
                      {isPlaying && <LivePulse small />}
                      {isPlaying ? 'Играет' : 'На паузе'}
                    </p>
                    <p className="truncate text-sm font-medium">
                      <TrackTitleText title={activeTrack.title} version={activeTrack.version} feat={activeTrack.feat} />
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{activeTrack.artistName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleTogglePlayback}
                    aria-label={isPlaying ? 'Поставить джем на паузу' : 'Возобновить джем'}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-90"
                  >
                    <Icon name={isPlaying ? 'pause' : 'play'} size={16} />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAdding((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors lg:hidden"
                >
                  <Icon name="plus" size={14} /> Добавить трек
                </button>
                <button
                  onClick={() => void jamQueue.shuffleQueue()}
                  disabled={jamQueue.queue.length < 2}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Icon name="shuffle" size={14} /> Перемешать
                </button>
              </div>

              {adding && (
                <div className="lg:hidden">
                  <JamAddPanel onAdd={handleAdd} suggestions={suggestions} />
                </div>
              )}

              {jamQueue.queue.length === 0 ? (
                <EmptyState
                  title="Очередь пуста"
                  hint="Добавьте первый трек, чтобы начать"
                  className="rounded-xl border border-dashed border-border/60 bg-card/20"
                />
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
                            size="roomy"
                            isActive={room.playback?.trackId === item.trackId}
                            isPlaying={
                              Boolean(room.playback && room.playback.trackId === item.trackId)
                              && !effectivePaused(room.playback, playbackPending)
                            }
                            onPlay={() => handleRowPlay(item)}
                            canDrag
                            canRemove={isHost || item.addedByParticipantId === membership.participantId}
                            onRemove={(id) => void jamQueue.removeTrack(id)}
                            removeLabel="Убрать из очереди"
                            onMoveUp={() => moveAdjacent(item.id, -1)}
                            onMoveDown={() => moveAdjacent(item.id, 1)}
                            canMoveUp={i > 0}
                            canMoveDown={i < jamQueue.queue.length - 1}
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

            <aside className="hidden lg:sticky lg:top-6 lg:flex lg:flex-col lg:gap-4 lg:self-start">
              <JamAddPanel onAdd={handleAdd} suggestions={suggestions} autoFocus={false} />
              <JamParticipants participants={room.participants} variant="inline" />
            </aside>
          </div>
        </PageContainer>
      </div>
    </div>
  );
}
