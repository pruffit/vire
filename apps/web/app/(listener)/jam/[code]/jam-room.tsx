'use client';
import { useCallback, useMemo, useState } from 'react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, TouchSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import type { JamMode, JamParticipant, JamParticipantRole, JamQueueItem, SearchTrack } from '@vire/core';
import { useJamSession } from '@/components/jam/jam-session-provider';
import { useJamQueue } from '@/lib/jam/use-jam-queue';
import { JAM_MODE_LABELS, JAM_MODE_OPTIONS } from '@/lib/jam/jam-mode-labels';
import { getSessionId } from '@/lib/session-id';
import { toast } from '@/lib/toast';
import { useJamStore } from '@/store/jam';
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

interface JoinResponse {
  participant: { id: string; role: JamParticipantRole };
}

const EMPTY_QUEUE: JamQueueItem[] = [];
const EMPTY_PARTICIPANTS: JamParticipant[] = [];

function noop(): void {}

export function JamRoom({ code, title, hostDisplayName, initialEnded, isLoggedIn, currentUserName, suggestions }: Props) {
  const [pending, setPending] = useState(false);
  const [adding, setAdding] = useState(false);

  const session = useJamSession();
  const activate = useJamStore((s) => s.activate);
  const activeSession = session && session.code === code ? session : null;

  // Латч: страница помнит, что джем завершился, даже когда контекст уже пропал —
  // сессия чистит стор сразу после jam:ended (см. jam-session-provider.tsx).
  const [ended, setEnded] = useState(initialEnded);
  if (activeSession?.room.ended && !ended) setEnded(true);

  const jamQueue = useJamQueue({
    code,
    sessionId: activeSession?.membership.sessionId ?? null,
    serverQueue: activeSession?.room.queue ?? EMPTY_QUEUE,
    setDragging: activeSession?.room.setDragging ?? noop,
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
      // Два аудио одновременно недопустимы — вход в звук джема глушит глобальный плеер.
      controls.pause();
      activate({ code, participantId: data.participant.id, role: data.participant.role, sessionId });
    } catch {
      toast.error('Не удалось подключиться к джему');
    } finally {
      setPending(false);
    }
  }, [code, isLoggedIn, currentUserName, activate]);

  const addedTrackIds = useMemo(
    () => new Set(jamQueue.queue.map((item) => item.trackId)),
    [jamQueue.queue],
  );

  const activeQueueIndex = useMemo(
    () => (activeSession?.room.playback
      ? jamQueue.queue.findIndex((item) => item.trackId === activeSession.room.playback!.trackId)
      : -1),
    [activeSession, jamQueue.queue],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const participants = activeSession?.room.participants ?? EMPTY_PARTICIPANTS;
  const participantsById = useMemo(
    () => new Map(participants.map((p) => [p.id, p.displayName])),
    [participants],
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) {
      jamQueue.cancelDrag();
      return;
    }
    void jamQueue.moveTrack(String(active.id), String(over.id));
  }

  function handleAdd(t: SearchTrack) {
    if (addedTrackIds.has(t.id)) return;
    void jamQueue.addTrack({
      id: `pending-${t.id}-${Date.now()}`,
      trackId: t.id,
      position: jamQueue.queue.length,
      addedByParticipantId: activeSession?.membership.participantId ?? null,
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

  if (!activeSession) {
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

  const { room, isHost, isAudioDevice, speakerName, isPlaying, actions } = activeSession;

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
                onChange={(v) => actions.changeMode(v as JamMode)}
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
                onClick={() => void actions.endJam()}
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
                  onClick={actions.claimSpeaker}
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
                            onPlay={() => actions.rowPlay(item)}
                            canDrag
                            canRemove={isHost || item.addedByParticipantId === activeSession.membership.participantId}
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
