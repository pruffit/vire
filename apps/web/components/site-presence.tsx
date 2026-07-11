'use client';

import { useEffect } from 'react';
import { getSessionId } from '@/lib/session-id';

/**
 * Heartbeat «онлайн на сайте» (админ-метрика); sessionId общий с плеером.
 * Серверное окно 45с (lib/presence.ts) — поэтому шлём раз в 20с.
 */
const HEARTBEAT_MS = 20_000;

export function SitePresence() {
  useEffect(() => {
    let stopped = false;
    const ping = async () => {
      if (stopped) return;
      try {
        const sessionId = await getSessionId();
        if (stopped) return;
        await fetch('/api/v1/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
          keepalive: true,
        });
      } catch {
        // присутствие косметическое — молча пропускаем тик
      }
    };
    ping();
    const timer = setInterval(ping, HEARTBEAT_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  return null;
}
