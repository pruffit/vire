'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, TouchSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import type { JamParticipantRole, JamQueueItem, JamMode, SearchTrack } from '@vire/core';
import { derivePositionMs, isAudioDevice as resolveIsAudioDevice, resolveSpeakerParticipantId } from '@vire/core';
import { useJamRoom } from '@/lib/jam/use-jam-room';
import { useJamQueue } from '@/lib/jam/use-jam-queue';
import { useServerClock } from '@/lib/jam/server-clock';
import { usePlaybackSync } from '@/lib/jam/use-playback-sync';
import { setJamTransport, type JamTransport } from '@/lib/jam/jam-controls';
import { effectivePaused, resolvePending, nextPendingVersion, PENDING_TTL_MS, type PendingToggle } from '@/lib/jam/optimistic-playback';
import { JAM_MODE_LABELS, JAM_MODE_OPTIONS } from '@/lib/jam/jam-mode-labels';
import { getSessionId } from '@/lib/session-id';
import { toast } from '@/lib/toast';
import { usePlayerStore } from '@/store/player';
import { controls } from '@/lib/player/audio-engine';
import { SortableTrackRow } from '@/components/sortable-track-row';
import { PageContainer } from '@/components/page-container';
import { Sheet } from '@/components/sheet';
import { JamShare } from '@/components/jam-share';
import { JamInvite } from '@/components/jam-invite';
import { ActionSelect } from '@/components/action-select';
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
  const myParticipantId = membership?.participantId ?? null;

  const resolvedSpeakerId = useMemo(
    () => resolveSpeakerParticipantId(room.participants, room.speakerParticipantId),
    [room.participants, room.speakerParticipantId],
  );
  const speakerName = room.participants.find((p) => p.id === resolvedSpeakerId)?.displayName ?? null;
  const isAudioDevice = useMemo(
    () => myParticipantId !== null && resolveIsAudioDevice({
      mode: room.mode, participantId: myParticipantId, participants: room.participants, speakerParticipantId: room.speakerParticipantId,
    }),
    [myParticipantId, room.mode, room.participants, room.speakerParticipantId],
  );

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
    // SYNCED: анти-гонка — только хост инициирует переход. SPEAKER: у пультов события ended нет вовсе,
    // это всегда звуковое устройство — проверка isAudioDevice тут для порядка.
    const initiator = room.mode === 'SYNCED' ? isHost : isAudioDevice;
    if (!initiator) return;
    const currentTrackId = room.playback?.trackId;
    const currentIndex = jamQueue.queue.findIndex((item) => item.trackId === currentTrackId);
    const next = currentIndex >= 0 ? jamQueue.queue[currentIndex + 1] : undefined;
    if (!next) return;
    postPlayback({ kind: 'track', trackId: next.trackId });
  }, [room.mode, isHost, isAudioDevice, room.playback, jamQueue.queue, postPlayback]);

  usePlaybackSync({
    playback: room.playback,
    serverNow,
    audioEnabled: audioEnabled && isAudioDevice && !ended,
    driftCorrection: room.mode === 'SYNCED',
    onEnded: handleTrackEnded,
  });

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

  const handleModeChange = useCallback((mode: JamMode) => {
    const sessionId = membership?.sessionId;
    fetch(`/api/v1/jam/${encodeURIComponent(code)}/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionId ? { mode, sessionId } : { mode }),
    })
      .then((res) => { if (!res.ok) throw new Error(String(res.status)); })
      .catch(() => toast.error('Не удалось сменить режим'));
  }, [code, membership?.sessionId]);

  const handleClaimSpeaker = useCallback(() => {
    const sessionId = membership?.sessionId;
    fetch(`/api/v1/jam/${encodeURIComponent(code)}/speaker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionId ? { sessionId } : {}),
    })
      .then((res) => { if (!res.ok) throw new Error(String(res.status)); })
      .catch(() => toast.error('Не удалось переключить звук'));
  }, [code, membership?.sessionId]);

  const handleRowPlay = useCallback((item: JamQueueItem) => {
    const playback = room.playback;
    if (playback?.trackId === item.trackId) {
      const paused = effectivePaused(playback, playbackPending);
      const next: PendingToggle = { paused: !paused, at: Date.now(), fromVersion: nextPendingVersion(playback, playbackPending) };
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
    const next: PendingToggle = { paused: !paused, at: Date.now(), fromVersion: nextPendingVersion(playback, playbackPending) };
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
    setPlaybackPending((prev) => resolvePending(prev, room.playback?.version ?? 0, Date.now(), PENDING_TTL_MS));
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

  const activeQueueIndex = useMemo(
    () => (room.playback ? jamQueue.queue.findIndex((item) => item.trackId === room.playback!.trackId) : -1),
    [room.playback, jamQueue.queue],
  );
  const activeTrack = activeQueueIndex >= 0 ? jamQueue.queue[activeQueueIndex] : undefined;
  const isPlaying = Boolean(room.playback) && !effectivePaused(room.playback, playbackPending);
  const canPrev = activeQueueIndex > 0;
  const canNext = activeQueueIndex >= 0 && activeQueueIndex < jamQueue.queue.length - 1;

  const addedTrackIds = useMemo(
    () => new Set(jamQueue.queue.map((item) => item.trackId)),
    [jamQueue.queue],
  );

  const setPlayerJamOverride = usePlayerStore((s) => s.setJamOverride);

  // Джем занимает глобальный плеер: пока звук джема играет, mini-bar показывает его трек и толкает транспорт джема.
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
      durationSec: activeTrack.durationSec,
      canPrev,
      canNext,
      isRemote: !isAudioDevice,
    });
  }, [audioEnabled, ended, activeTrack, isPlaying, canPrev, canNext, code, isAudioDevice, setPlayerJamOverride]);

  // Отдельно от основного эффекта — гарантирует чистку при уходе со страницы независимо от того,
  // какая ветка выше сработала последней.
  useEffect(() => () => setPlayerJamOverride(null), [setPlayerJamOverride]);

  // Рефы держат актуальные значения для транспорта — эффект регистрации не пересоздаёт объект на каждый тик позиции.
  const roomPlaybackRef = useRef(room.playback);
  const queueRef = useRef(jamQueue.queue);
  const playbackPendingRef = useRef(playbackPending);
  const serverNowRef = useRef(serverNow);
  useEffect(() => {
    roomPlaybackRef.current = room.playback;
    queueRef.current = jamQueue.queue;
    playbackPendingRef.current = playbackPending;
    serverNowRef.current = serverNow;
  });

  useEffect(() => {
    const transport: JamTransport = {
      toggle: handleTogglePlayback,
      next: () => {
        const playback = roomPlaybackRef.current;
        const i = queueRef.current.findIndex((item) => item.trackId === playback?.trackId);
        const target = i >= 0 ? queueRef.current[i + 1] : undefined;
        if (target) postPlayback({ kind: 'track', trackId: target.trackId });
      },
      prev: () => {
        const playback = roomPlaybackRef.current;
        const i = queueRef.current.findIndex((item) => item.trackId === playback?.trackId);
        const target = i > 0 ? queueRef.current[i - 1] : undefined;
        if (target) postPlayback({ kind: 'track', trackId: target.trackId });
      },
      seek: (ms) => {
        const playback = roomPlaybackRef.current;
        if (!playback) return;
        const paused = effectivePaused(playback, playbackPendingRef.current);
        postPlayback(
          paused
            ? { kind: 'pause', positionMs: ms }
            : { kind: 'play', trackId: playback.trackId, positionMs: ms },
        );
      },
      positionMs: () => {
        const playback = roomPlaybackRef.current;
        return playback ? derivePositionMs(playback, serverNowRef.current()) : 0;
      },
    };
    setJamTransport(transport);
    return () => setJamTransport(null);
  }, [handleTogglePlayback, postPlayback]);

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
    if (addedTrackIds.has(t.id)) return;
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-muted-foreground">
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
          <div className="flex flex-wrap items-center justify-end gap-1 sm:flex-nowrap sm:shrink-0">
            {isHost ? (
              <ActionSelect
                options={JAM_MODE_OPTIONS}
                value={room.mode}
                onChange={(v) => handleModeChange(v as JamMode)}
                ariaLabel="Режим воспроизведения"
              />
            ) : (
              <span className="rounded-full border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground">
                {JAM_MODE_LABELS[room.mode]}
              </span>
            )}
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

        {room.mode === 'SPEAKER' && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {isAudioDevice ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-primary">
                <Icon name="volume-2" size={12} /> Звук здесь
              </span>
            ) : (
              <>
                <span>Играет на устройстве {speakerName ?? '—'}</span>
                <button
                  type="button"
                  onClick={handleClaimSpeaker}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border px-3 text-sm text-foreground hover:bg-foreground/5 transition-colors"
                >
                  <Icon name="volume-2" size={12} /> Звук здесь
                </button>
              </>
            )}
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <PageContainer as="div" variant="compact">
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6">
            <div className="min-w-0 space-y-4">
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

              <Sheet open={adding} onClose={() => setAdding(false)} anchor="bottom">
                <div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
                  <JamAddPanel onAdd={handleAdd} suggestions={suggestions} addedTrackIds={addedTrackIds} dense />
                </div>
              </Sheet>

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
                            isActive={i === activeQueueIndex}
                            isPlaying={i === activeQueueIndex && isPlaying}
                            onPlay={() => handleRowPlay(item)}
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

            <aside className="hidden lg:sticky lg:top-6 lg:flex lg:flex-col lg:gap-4 lg:self-start">
              <JamAddPanel onAdd={handleAdd} suggestions={suggestions} addedTrackIds={addedTrackIds} autoFocus={false} />
              <JamParticipants participants={room.participants} variant="inline" />
            </aside>
          </div>
        </PageContainer>
      </div>
    </div>
  );
}
