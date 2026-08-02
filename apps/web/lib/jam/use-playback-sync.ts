'use client';

import { useEffect, useRef } from 'react';
import { decideDriftCorrection, derivePositionMs, type JamPlaybackState } from '@vire/core';
import { createJamAudio, type JamAudioEngine, type PlayableSource } from './jam-audio';

const SYNC_INTERVAL_MS = 10_000;

export interface UsePlaybackSyncArgs {
  playback: JamPlaybackState | null;
  /** Резолвится из позиции очереди по playback.itemId (провайдером); null — источник недоступен на этом устройстве (нет контейнера/файла) или снапшот ещё не долетел, движок простаивает. */
  source: PlayableSource | null;
  serverNow: () => number;
  /** Звук разблокирован жестом пользователя — до этого движок не создаём (автоплей заблокирован браузером). */
  audioEnabled: boolean;
  /** На звуковом устройстве в режиме SPEAKER синхронизировать не с кем — периодическая коррекция дрейфа выключается. Дефолт true (SYNCED). */
  driftCorrection?: boolean;
  onEnded?: () => void;
}

/** Владеет `JamAudioEngine`: создаёт его при разблокировке звука, применяет решения `jam-sync` и уничтожает при размонтировании. */
export function usePlaybackSync({ playback, source, serverNow, audioEnabled, driftCorrection = true, onEnded }: UsePlaybackSyncArgs): void {
  const engineRef = useRef<JamAudioEngine | null>(null);
  const onEndedRef = useRef(onEnded);
  const loadedItemIdRef = useRef<string | null>(null);
  const pausedRef = useRef<boolean | null>(null);
  const lastHardSeekAtRef = useRef<number | null>(null);
  const unsubscribeResyncRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    if (!audioEnabled) return;
    const engine = createJamAudio();
    engineRef.current = engine;
    const unsubscribe = engine.onEnded(() => onEndedRef.current?.());

    return () => {
      unsubscribe();
      unsubscribeResyncRef.current?.();
      unsubscribeResyncRef.current = null;
      engine.destroy();
      engineRef.current = null;
      loadedItemIdRef.current = null;
      pausedRef.current = null;
      lastHardSeekAtRef.current = null;
    };
  }, [audioEnabled]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !playback) return;

    // Ресинк по первому реальному `playing`: позиция ДО этого считается до конца буферизации
    // первого сегмента и стабильно отстаёт. Одноразово — снимает себя после первого срабатывания.
    // Только при включённой синхронизации: одному слушателю этот прыжок съел бы начало трека.
    function resyncOnPlaying(target: JamPlaybackState): void {
      if (!driftCorrection) return;
      unsubscribeResyncRef.current?.();
      const unsubscribe = engine!.onPlaying(() => {
        unsubscribe();
        unsubscribeResyncRef.current = null;
        if (loadedItemIdRef.current !== target.itemId) return;
        engine!.seek(derivePositionMs(target, serverNow()));
      });
      unsubscribeResyncRef.current = unsubscribe;
    }

    if (loadedItemIdRef.current !== playback.itemId) {
      pausedRef.current = playback.paused;
      lastHardSeekAtRef.current = null;
      unsubscribeResyncRef.current?.();
      unsubscribeResyncRef.current = null;

      // Источник недоступен на этом устройстве (нет контейнера/файла) либо снапшот очереди ещё не долетел.
      // Позицию НЕ помечаем загруженной — иначе пришедшая следом очередь уже не запустит трек.
      if (source === null) {
        loadedItemIdRef.current = null;
        engine.pause();
        return;
      }

      loadedItemIdRef.current = playback.itemId;
      void engine.load(source).then(() => {
        // load предыдущей позиции резолвится досрочно при смене — не позиционируем по устаревшему состоянию
        if (loadedItemIdRef.current !== playback.itemId) return;
        // Грубая наводка сразу (не грузить трек с нуля), точная позиция — по ресинку ниже.
        engine.seek(derivePositionMs(playback, serverNow()));
        if (!playback.paused) {
          resyncOnPlaying(playback);
          engine.play();
        }
      });
      return;
    }

    if (source === null) return;

    if (pausedRef.current !== playback.paused) {
      pausedRef.current = playback.paused;
      if (playback.paused) {
        unsubscribeResyncRef.current?.();
        unsubscribeResyncRef.current = null;
        engine.pause();
      } else {
        engine.seek(derivePositionMs(playback, serverNow()));
        resyncOnPlaying(playback);
        engine.play();
      }
    }
  }, [playback, source, serverNow, driftCorrection]);

  useEffect(() => {
    if (!playback || playback.paused || source === null) return;
    if (!driftCorrection) return;

    function runCorrection(): void {
      const engine = engineRef.current;
      if (!engine || !playback || playback.paused) return;
      const nowMs = Date.now();
      const expected = derivePositionMs(playback, serverNow());
      const actual = engine.currentTimeMs();
      const damper = {
        buffering: engine.isBuffering(),
        msSinceHardSeek: lastHardSeekAtRef.current === null ? null : nowMs - lastHardSeekAtRef.current,
      };
      const action = decideDriftCorrection(expected, actual, damper);
      if (action.kind === 'seek') {
        engine.seek(action.toMs);
        lastHardSeekAtRef.current = nowMs;
      }
    }

    const interval = setInterval(runCorrection, SYNC_INTERVAL_MS);
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') runCorrection();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [playback, source, serverNow, driftCorrection]);
}
