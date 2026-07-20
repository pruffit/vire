'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { pickClockOffset } from '@vire/core';

const SAMPLE_COUNT = 5;
const RESYNC_INTERVAL_MS = 5 * 60 * 1_000;
const TIME_ENDPOINT = '/api/v1/jam/time';

export interface UseServerClockResult {
  offsetMs: number;
  serverNow: () => number;
}

async function sampleOffset(signal: AbortSignal): Promise<number | null> {
  const samples: Array<{ t0: number; tServer: number; t1: number }> = [];
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const t0 = Date.now();
    const res = await fetch(TIME_ENDPOINT, { cache: 'no-store', signal }).catch(() => null);
    if (!res?.ok) return null;
    const body = (await res.json().catch(() => null)) as { now?: number } | null;
    const t1 = Date.now();
    if (typeof body?.now !== 'number') return null;
    samples.push({ t0, tServer: body.now, t1 });
  }
  return pickClockOffset(samples);
}

/** offsetRef держит последнее валидное значение — деградация не откатывает его к 0. */
export function useServerClock(): UseServerClockResult {
  const [offsetMs, setOffsetMs] = useState(0);
  const offsetRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;

    const resync = async () => {
      const offset = await sampleOffset(controller.signal);
      if (disposed || offset === null) return;
      offsetRef.current = offset;
      setOffsetMs(offset);
    };

    void resync();
    const timer = setInterval(() => void resync(), RESYNC_INTERVAL_MS);

    return () => {
      disposed = true;
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

  return { offsetMs, serverNow };
}
