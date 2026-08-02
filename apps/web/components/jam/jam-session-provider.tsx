'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { JamMode, JamParticipantRole, JamQueueItem } from '@vire/core';
import { derivePositionMs, isAudioDevice as resolveIsAudioDevice, resolveSpeakerParticipantId } from '@vire/core';
import { useJamRoom, type UseJamRoomResult } from '@/lib/jam/use-jam-room';
import { useServerClock } from '@/lib/jam/server-clock';
import { usePlaybackSync } from '@/lib/jam/use-playback-sync';
import { setJamTransport, type JamTransport } from '@/lib/jam/jam-controls';
import { effectivePaused, resolvePending, nextPendingVersion, PENDING_TTL_MS, type PendingToggle } from '@/lib/jam/optimistic-playback';
import { toast } from '@/lib/toast';
import { usePlayerStore } from '@/store/player';
import { useJamStore, type ActiveJam } from '@/store/jam';

type PlaybackCommand =
  | { kind: 'play'; itemId: string; positionMs: number }
  | { kind: 'pause'; positionMs: number }
  | { kind: 'track'; itemId: string };

export interface JamSessionValue {
  code: string;
  membership: { participantId: string; role: JamParticipantRole; sessionId: string | null };
  role: JamParticipantRole;
  isHost: boolean;
  room: UseJamRoomResult;
  serverNow: () => number;
  isAudioDevice: boolean;
  speakerName: string | null;
  playbackPending: PendingToggle | null;
  isPlaying: boolean;
  /** Позиция очереди (jam_queue_items.id) — подсветка активной строки должна идти по нему, не по trackId. */
  activeItemId: string | null;
  activeTrackId: string | null;
  actions: {
    rowPlay: (item: JamQueueItem) => void;
    toggle: () => void;
    changeMode: (mode: JamMode) => void;
    claimSpeaker: () => void;
    endJam: () => Promise<void>;
    leave: () => void;
  };
}

const JamSessionContext = createContext<JamSessionValue | null>(null);

export function useJamSession(): JamSessionValue | null {
  return useContext(JamSessionContext);
}

/** Живёт в app-shell, не на странице `/jam/[code]` — уход со страницы больше не убивает джем (SSE/движок/оверлей). */
export function JamSessionProvider({ children }: { children: ReactNode }) {
  const active = useJamStore((s) => s.active);
  if (!active) return <>{children}</>;
  return <ActiveJamSession active={active}>{children}</ActiveJamSession>;
}

function ActiveJamSession({ active, children }: { active: ActiveJam; children: ReactNode }) {
  const { code, participantId, role, sessionId } = active;
  const audioEnabled = useJamStore((s) => s.audioEnabled);
  const leaveStore = useJamStore((s) => s.leave);
  const [playbackPending, setPlaybackPending] = useState<PendingToggle | null>(null);

  const room = useJamRoom(code, sessionId);
  const { serverNow } = useServerClock();

  const isHost = role === 'HOST';

  const resolvedSpeakerId = useMemo(
    () => resolveSpeakerParticipantId(room.participants, room.speakerParticipantId),
    [room.participants, room.speakerParticipantId],
  );
  const speakerName = room.participants.find((p) => p.id === resolvedSpeakerId)?.displayName ?? null;
  const isAudioDevice = useMemo(
    () => resolveIsAudioDevice({
      mode: room.mode, participantId, participants: room.participants, speakerParticipantId: room.speakerParticipantId,
    }),
    [participantId, room.mode, room.participants, room.speakerParticipantId],
  );
  // SPEAKER — звук всегда на одном устройстве; SYNCED — сколько участников реально держат живое SSE-соединение.
  const audioDeviceCount = room.mode === 'SPEAKER' ? 1 : room.presentParticipantIds.length;

  const postPlayback = useCallback((body: PlaybackCommand, onError?: () => void) => {
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
  }, [code, sessionId]);

  const handleTrackEnded = useCallback(() => {
    // SYNCED: анти-гонка — только хост инициирует переход. SPEAKER: у пультов события ended нет вовсе,
    // это всегда звуковое устройство — проверка isAudioDevice тут для порядка.
    const initiator = room.mode === 'SYNCED' ? isHost : isAudioDevice;
    if (!initiator) return;
    const currentItemId = room.playback?.itemId;
    const currentIndex = room.queue.findIndex((item) => item.id === currentItemId);
    const next = currentIndex >= 0 ? room.queue[currentIndex + 1] : undefined;
    if (!next) return;
    postPlayback({ kind: 'track', itemId: next.id });
  }, [room.mode, isHost, isAudioDevice, room.playback, room.queue, postPlayback]);

  const activeQueueIndex = useMemo(
    () => (room.playback ? room.queue.findIndex((item) => item.id === room.playback!.itemId) : -1),
    [room.playback, room.queue],
  );
  const activeTrack = activeQueueIndex >= 0 ? room.queue[activeQueueIndex] : undefined;

  usePlaybackSync({
    playback: room.playback,
    trackId: activeTrack?.trackId ?? null,
    serverNow,
    audioEnabled: audioEnabled && isAudioDevice && !room.ended,
    driftCorrection: room.mode === 'SYNCED' && audioDeviceCount > 1,
    onEnded: handleTrackEnded,
  });

  const handleModeChange = useCallback((mode: JamMode) => {
    fetch(`/api/v1/jam/${encodeURIComponent(code)}/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionId ? { mode, sessionId } : { mode }),
    })
      .then((res) => { if (!res.ok) throw new Error(String(res.status)); })
      .catch(() => toast.error('Не удалось сменить режим'));
  }, [code, sessionId]);

  const handleClaimSpeaker = useCallback(() => {
    fetch(`/api/v1/jam/${encodeURIComponent(code)}/speaker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionId ? { sessionId } : {}),
    })
      .then((res) => { if (!res.ok) throw new Error(String(res.status)); })
      .catch(() => toast.error('Не удалось переключить звук'));
  }, [code, sessionId]);

  const handleRowPlay = useCallback((item: JamQueueItem) => {
    const playback = room.playback;
    if (playback?.itemId === item.id) {
      const paused = effectivePaused(playback, playbackPending);
      const next: PendingToggle = { paused: !paused, at: Date.now(), fromVersion: nextPendingVersion(playback, playbackPending) };
      postPlayback(
        paused
          ? { kind: 'play', itemId: item.id, positionMs: derivePositionMs(playback, serverNow()) }
          : { kind: 'pause', positionMs: derivePositionMs(playback, serverNow()) },
        () => setPlaybackPending((prev) => (prev === next ? null : prev)),
      );
      setPlaybackPending(next);
    } else {
      setPlaybackPending(null);
      postPlayback({ kind: 'track', itemId: item.id });
    }
  }, [room.playback, playbackPending, serverNow, postPlayback]);

  const handleTogglePlayback = useCallback(() => {
    const playback = room.playback;
    if (!playback) return;
    const paused = effectivePaused(playback, playbackPending);
    const next: PendingToggle = { paused: !paused, at: Date.now(), fromVersion: nextPendingVersion(playback, playbackPending) };
    postPlayback(
      paused
        ? { kind: 'play', itemId: playback.itemId, positionMs: derivePositionMs(playback, serverNow()) }
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

  const isPlaying = Boolean(room.playback) && !effectivePaused(room.playback, playbackPending);
  const canPrev = activeQueueIndex > 0;
  const canNext = activeQueueIndex >= 0 && activeQueueIndex < room.queue.length - 1;

  const setPlayerJamOverride = usePlayerStore((s) => s.setJamOverride);

  // Джем занимает глобальный плеер, пока сессия активна — независимо от audioEnabled:
  // после F5 звук ещё не разблокирован жестом, но бар и путь назад в комнату обязаны быть.
  // Условие гашения (ended) проверяется первым и не зависит от activeTrack — иначе рендер,
  // где playback/очередь ещё не согласовались, мог бы отложить чистку оверлея.
  useEffect(() => {
    if (room.ended) {
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
      needsAudioGesture: !audioEnabled,
    });
  }, [room.ended, activeTrack, isPlaying, canPrev, canNext, code, isAudioDevice, audioEnabled, setPlayerJamOverride]);

  // Отдельно от основного эффекта — гарантирует чистку при размонтировании независимо от того,
  // какая ветка выше сработала последней.
  useEffect(() => () => setPlayerJamOverride(null), [setPlayerJamOverride]);

  // Рефы держат актуальные значения для транспорта — эффект регистрации не пересоздаёт объект на каждый тик позиции.
  const roomPlaybackRef = useRef(room.playback);
  const queueRef = useRef(room.queue);
  const playbackPendingRef = useRef(playbackPending);
  const serverNowRef = useRef(serverNow);
  useEffect(() => {
    roomPlaybackRef.current = room.playback;
    queueRef.current = room.queue;
    playbackPendingRef.current = playbackPending;
    serverNowRef.current = serverNow;
  });

  useEffect(() => {
    const transport: JamTransport = {
      toggle: handleTogglePlayback,
      next: () => {
        const playback = roomPlaybackRef.current;
        const i = queueRef.current.findIndex((item) => item.id === playback?.itemId);
        const target = i >= 0 ? queueRef.current[i + 1] : undefined;
        if (target) postPlayback({ kind: 'track', itemId: target.id });
      },
      prev: () => {
        const playback = roomPlaybackRef.current;
        const i = queueRef.current.findIndex((item) => item.id === playback?.itemId);
        const target = i > 0 ? queueRef.current[i - 1] : undefined;
        if (target) postPlayback({ kind: 'track', itemId: target.id });
      },
      seek: (ms) => {
        const playback = roomPlaybackRef.current;
        if (!playback) return;
        const paused = effectivePaused(playback, playbackPendingRef.current);
        postPlayback(
          paused
            ? { kind: 'pause', positionMs: ms }
            : { kind: 'play', itemId: playback.itemId, positionMs: ms },
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

  useEffect(() => {
    if (!room.ended) return;
    leaveStore();
    toast('Джем завершён');
  }, [room.ended, leaveStore]);

  // Протухшая запись в localStorage (кик, удалённый джем, чужой sessionId) иначе даёт вечный
  // реконнект SSE без следа в UI: EventSource молча ретраит любую 4xx. Сетевую ошибку не считаем
  // поводом выкинуть — офлайн не должен рвать джем.
  useEffect(() => {
    const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
    let cancelled = false;
    void fetch(`/api/v1/jam/${encodeURIComponent(code)}${query}`)
      .then((res) => {
        if (!cancelled && res.status >= 400 && res.status < 500) leaveStore();
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [code, sessionId, leaveStore]);

  const handleEndJam = useCallback(async () => {
    if (!confirm('Завершить джем для всех?')) return;
    const res = await fetch(`/api/v1/jam/${encodeURIComponent(code)}/end`, { method: 'POST' }).catch(() => null);
    if (!res?.ok) toast.error('Не удалось завершить джем');
  }, [code]);

  const value = useMemo<JamSessionValue>(() => ({
    code,
    membership: { participantId, role, sessionId },
    role,
    isHost,
    room,
    serverNow,
    isAudioDevice,
    speakerName,
    playbackPending,
    isPlaying,
    activeItemId: activeTrack?.id ?? null,
    activeTrackId: activeTrack?.trackId ?? null,
    actions: {
      rowPlay: handleRowPlay,
      toggle: handleTogglePlayback,
      changeMode: handleModeChange,
      claimSpeaker: handleClaimSpeaker,
      endJam: handleEndJam,
      leave: leaveStore,
    },
  }), [
    code, participantId, role, sessionId, isHost, room, serverNow, isAudioDevice, speakerName,
    playbackPending, isPlaying, activeTrack, handleRowPlay, handleTogglePlayback, handleModeChange,
    handleClaimSpeaker, handleEndJam, leaveStore,
  ]);

  return <JamSessionContext.Provider value={value}>{children}</JamSessionContext.Provider>;
}
