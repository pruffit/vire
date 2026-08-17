import { useEffect, useRef, useState } from 'react';
import { usePlayerStore, type PlayerTrack } from '@/store/player';
import { controls } from './audio-engine';
import { isDesktopApp } from '@/lib/desktop-app';

export const DESKTOP_PLAYER_CHANNEL = 'vire-desktop-player';

export interface DesktopPlayerTrack {
  title: string;
  artistName: string;
  coverUrl: string | null;
  accentColor?: string;
}

export interface DesktopPlayerState {
  track: DesktopPlayerTrack | null;
  isPlaying: boolean;
  positionSec: number;
  durationSec: number;
}

type DesktopSyncMessage =
  | { type: 'state'; state: DesktopPlayerState }
  | { type: 'requestState' }
  | { type: 'togglePlay' | 'next' | 'prev' };

const EMPTY_STATE: DesktopPlayerState = { track: null, isPlaying: false, positionSec: 0, durationSec: 0 };

function toDesktopTrack(track: PlayerTrack | null): DesktopPlayerTrack | null {
  if (!track) return null;
  return { title: track.title, artistName: track.artistName, coverUrl: track.coverUrl, accentColor: track.accentColor };
}

function currentState(): DesktopPlayerState {
  const { track, isPlaying, currentTime, duration } = usePlayerStore.getState();
  return { track: toDesktopTrack(track), isPlaying, positionSec: currentTime, durationSec: duration };
}

let publisherInitialized = false;

/**
 * Главное окно: единственный источник правды рассылает состояние плеера окну
 * мини-плеера через BroadcastChannel (оба окна Tauri грузят один origin — Rust IPC
 * для этого моста сознательно не открыт, см. docs/features/desktop-app.md).
 */
export function initDesktopPlayerPublisher(): void {
  if (publisherInitialized || !isDesktopApp() || typeof BroadcastChannel === 'undefined') return;
  publisherInitialized = true;

  const channel = new BroadcastChannel(DESKTOP_PLAYER_CHANNEL);

  function broadcast(): void {
    const message: DesktopSyncMessage = { type: 'state', state: currentState() };
    channel.postMessage(message);
  }

  channel.onmessage = (event: MessageEvent<DesktopSyncMessage>) => {
    const msg = event.data;
    if (msg.type === 'requestState') broadcast();
    else if (msg.type === 'togglePlay') controls.togglePlay();
    else if (msg.type === 'next') void controls.next();
    else if (msg.type === 'prev') controls.prev();
  };

  usePlayerStore.subscribe((state, prev) => {
    if (
      state.track !== prev.track ||
      state.isPlaying !== prev.isPlaying ||
      state.currentTime !== prev.currentTime ||
      state.duration !== prev.duration
    ) {
      broadcast();
    }
  });

  // Периодический тик поверх событийных обновлений — окно мини-плеера, открытое во
  // время игры, не зависит только от редких изменений currentTime.
  setInterval(() => {
    if (usePlayerStore.getState().isPlaying) broadcast();
  }, 1000);
}

/**
 * Окно мини-плеера: подписывается на состояние из главного окна, локально
 * интерполирует позицию между сообщениями (для плавного прогресс-бара) и шлёт
 * команды транспорта обратно тем же каналом.
 */
export function useMiniPlayerState(): {
  track: DesktopPlayerTrack | null;
  isPlaying: boolean;
  positionSec: number;
  durationSec: number;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
} {
  const [state, setState] = useState<DesktopPlayerState>(EMPTY_STATE);
  const [displayPosition, setDisplayPosition] = useState(0);
  // at:0 — плейсхолдер, реальный якорь ставится в эффекте ниже (Date.now() в теле рендера непозволителен).
  const anchorRef = useRef({ positionSec: 0, at: 0 });
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(DESKTOP_PLAYER_CHANNEL);
    channelRef.current = channel;
    let receivedFirstState = false;

    channel.onmessage = (event: MessageEvent<DesktopSyncMessage>) => {
      if (event.data.type !== 'state') return;
      receivedFirstState = true;
      const next = event.data.state;
      anchorRef.current = { positionSec: next.positionSec, at: Date.now() };
      setState(next);
      setDisplayPosition(next.positionSec);
    };

    const request: DesktopSyncMessage = { type: 'requestState' };
    channel.postMessage(request);

    // Оба окна инициализируются параллельно при старте приложения — паблишер
    // главного окна может ещё не слушать канал в момент первого requestState
    // (BroadcastChannel не буферизует сообщения для ещё не подключившихся
    // слушателей). Повторяем, пока не придёт первый ответ.
    const retry = setInterval(() => {
      if (receivedFirstState) {
        clearInterval(retry);
        return;
      }
      channel.postMessage(request);
    }, 500);

    return () => {
      clearInterval(retry);
      channel.close();
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!state.isPlaying) return;
    const id = setInterval(() => {
      const elapsed = (Date.now() - anchorRef.current.at) / 1000;
      const cap = state.durationSec > 0 ? state.durationSec : Infinity;
      setDisplayPosition(Math.min(anchorRef.current.positionSec + elapsed, cap));
    }, 250);
    return () => clearInterval(id);
  }, [state.isPlaying, state.durationSec]);

  function send(message: DesktopSyncMessage): void {
    channelRef.current?.postMessage(message);
  }

  return {
    track: state.track,
    isPlaying: state.isPlaying,
    positionSec: displayPosition,
    durationSec: state.durationSec,
    togglePlay: () => send({ type: 'togglePlay' }),
    next: () => send({ type: 'next' }),
    prev: () => send({ type: 'prev' }),
  };
}
