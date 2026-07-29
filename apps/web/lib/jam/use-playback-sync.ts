'use client';

import { useEffect, useRef } from 'react';
import { decideDriftCorrection, derivePositionMs, type JamPlaybackState } from '@vire/core';
import { createJamAudio, type JamAudioEngine } from './jam-audio';

const SYNC_INTERVAL_MS = 2_000;

export interface UsePlaybackSyncArgs {
  playback: JamPlaybackState | null;
  serverNow: () => number;
  /** Звук разблокирован жестом пользователя — до этого движок не создаём (автоплей заблокирован браузером). */
  audioEnabled: boolean;
  onEnded?: () => void;
}

/** Владеет `JamAudioEngine`: создаёт его при разблокировке звука, применяет решения `jam-sync` и уничтожает при размонтировании. */
export function usePlaybackSync({ playback, serverNow, audioEnabled, onEnded }: UsePlaybackSyncArgs): void {
  const engineRef = useRef<JamAudioEngine | null>(null);
  const onEndedRef = useRef(onEnded);
  const loadedTrackIdRef = useRef<string | null>(null);
  const pausedRef = useRef<boolean | null>(null);
  const rateRef = useRef(1);
  const lastHardSeekAtRef = useRef<number | null>(null);
  const rateCorrectionStartedAtRef = useRef<number | null>(null);

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
      engine.destroy();
      engineRef.current = null;
      loadedTrackIdRef.current = null;
      pausedRef.current = null;
      rateRef.current = 1;
      lastHardSeekAtRef.current = null;
      rateCorrectionStartedAtRef.current = null;
    };
  }, [audioEnabled]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !playback) return;

    if (loadedTrackIdRef.current !== playback.trackId) {
      loadedTrackIdRef.current = playback.trackId;
      pausedRef.current = playback.paused;
      rateRef.current = 1;
      lastHardSeekAtRef.current = null;
      rateCorrectionStartedAtRef.current = null;
      void engine.load(playback.trackId).then(() => {
        // load предыдущего трека резолвится досрочно при смене — не позиционируем по устаревшему состоянию
        if (loadedTrackIdRef.current !== playback.trackId) return;
        engine.setRate(1);
        engine.seek(derivePositionMs(playback, serverNow()));
        if (!playback.paused) engine.play();
      });
      return;
    }

    if (pausedRef.current !== playback.paused) {
      pausedRef.current = playback.paused;
      rateRef.current = 1;
      rateCorrectionStartedAtRef.current = null;
      if (playback.paused) {
        engine.pause();
        engine.setRate(1);
      } else {
        engine.setRate(1);
        engine.seek(derivePositionMs(playback, serverNow()));
        engine.play();
      }
    }
  }, [playback, serverNow]);

  useEffect(() => {
    if (!playback || playback.paused) return;

    function runCorrection(): void {
      const engine = engineRef.current;
      if (!engine || !playback || playback.paused) return;
      const nowMs = Date.now();
      const expected = derivePositionMs(playback, serverNow());
      const actual = engine.currentTimeMs();
      const damper = {
        buffering: engine.isBuffering(),
        msSinceHardSeek: lastHardSeekAtRef.current === null ? null : nowMs - lastHardSeekAtRef.current,
        msInRateCorrection: rateCorrectionStartedAtRef.current === null ? null : nowMs - rateCorrectionStartedAtRef.current,
      };
      const action = decideDriftCorrection(expected, actual, rateRef.current, damper);
      if (action.kind === 'seek') {
        engine.seek(action.toMs);
        engine.setRate(1);
        rateRef.current = 1;
        lastHardSeekAtRef.current = nowMs;
        rateCorrectionStartedAtRef.current = null;
      } else if (action.kind === 'rate') {
        if (action.rate === 1) {
          rateCorrectionStartedAtRef.current = null;
        } else if (rateCorrectionStartedAtRef.current === null) {
          rateCorrectionStartedAtRef.current = nowMs;
        }
        engine.setRate(action.rate);
        rateRef.current = action.rate;
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
  }, [playback, serverNow]);
}
