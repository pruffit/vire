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
  /**
   * Фактическая позиция звука в момент, когда он реально пошёл, при выключенной коррекции.
   * Колонка одна — правду знает она, а не серверные часы: за время буферизации embed-плеера
   * часы уходят вперёд на секунды, и подтягивать надо их, а не звук (иначе трек прыгнет).
   */
  onActualPosition?: (positionMs: number) => void;
  onEnded?: () => void;
  /** Пользователь нажал play/pause внутри встроенного плеера — состояние джема идёт за ним. */
  onUserToggle?: (playing: boolean) => void;
}

/** Расхождение меньше этого — эхо собственной команды, а не перемотка: лишний seek только дёргает звук. */
const SEEK_EPSILON_MS = 1_200;
/** Ниже этого расхождение часов и звука незаметно — не гоняем лишний round-trip. */
const CLOCK_FIX_MIN_MS = 1_000;

/** Владеет `JamAudioEngine`: создаёт его при разблокировке звука, применяет решения `jam-sync` и уничтожает при размонтировании. */
export function usePlaybackSync({ playback, source, serverNow, audioEnabled, driftCorrection = true, onActualPosition, onEnded, onUserToggle }: UsePlaybackSyncArgs): void {
  const engineRef = useRef<JamAudioEngine | null>(null);
  const onEndedRef = useRef(onEnded);
  const onActualPositionRef = useRef(onActualPosition);
  const onUserToggleRef = useRef(onUserToggle);
  const loadedItemIdRef = useRef<string | null>(null);
  const pausedRef = useRef<boolean | null>(null);
  const lastVersionRef = useRef<number | null>(null);
  const lastHardSeekAtRef = useRef<number | null>(null);
  const unsubscribeResyncRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onEndedRef.current = onEnded;
    onActualPositionRef.current = onActualPosition;
    onUserToggleRef.current = onUserToggle;
  }, [onEnded, onActualPosition, onUserToggle]);

  useEffect(() => {
    if (!audioEnabled) return;
    const engine = createJamAudio();
    engineRef.current = engine;
    const unsubscribe = engine.onEnded(() => onEndedRef.current?.());
    const unsubscribeToggle = engine.onUserToggle((playing) => onUserToggleRef.current?.(playing));

    return () => {
      unsubscribe();
      unsubscribeToggle();
      unsubscribeResyncRef.current?.();
      unsubscribeResyncRef.current = null;
      engine.destroy();
      engineRef.current = null;
      loadedItemIdRef.current = null;
      pausedRef.current = null;
      lastVersionRef.current = null;
      lastHardSeekAtRef.current = null;
    };
  }, [audioEnabled]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !playback) return;

    // Одноразовая сверка по первому реальному `playing`: до него позиция считается всё время
    // буферизации и часы уходят вперёд на секунды. Кого подтягивать — зависит от режима.
    function resyncOnPlaying(target: JamPlaybackState): void {
      unsubscribeResyncRef.current?.();
      const unsubscribe = engine!.onPlaying(() => {
        unsubscribe();
        unsubscribeResyncRef.current = null;
        if (loadedItemIdRef.current !== target.itemId) return;

        const expected = derivePositionMs(target, serverNow());
        // Колонок несколько — правду задают общие часы, звук догоняет их.
        if (driftCorrection) {
          engine!.seek(expected);
          return;
        }
        // Колонка одна: прыжок вперёд съел бы начало трека, поэтому наоборот — двигаем часы под звук.
        const actual = engine!.currentTimeMs();
        if (Math.abs(expected - actual) >= CLOCK_FIX_MIN_MS) onActualPositionRef.current?.(actual);
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
      lastVersionRef.current = playback.version;
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

    // Новая версия состояния на той же позиции очереди = кто-то перемотал. Без этого seek
    // не доезжал до движка вовсе: смены трека нет, флаг паузы прежний, а коррекция дрейфа
    // в режиме «на колонке» выключена — позиция не выправлялась никогда.
    if (lastVersionRef.current !== playback.version) {
      lastVersionRef.current = playback.version;
      const target = derivePositionMs(playback, serverNow());
      // Порог отсекает эхо собственной команды (round-trip в сотни мс) — дёргать звук на нём нельзя.
      if (Math.abs(target - engine.currentTimeMs()) > SEEK_EPSILON_MS) {
        engine.seek(target);
        lastHardSeekAtRef.current = Date.now();
      }
    }

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
