'use client';

import { useEffect } from 'react';
import { getSessionId } from '@/lib/session-id';

/**
 * Heartbeat присутствия на сайте — монтируется один раз в корневом layout, шлёт
 * пинг с любой страницы (не только когда играет трек). Даёт админ-метрику
 * «онлайн на сайте». sessionId общий с плеером (sessionStorage `vire_sid`), окно
 * на сервере 45с (см. lib/presence.ts), поэтому шлём раз в 20с.
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
        // Сеть/сервер недоступны — присутствие косметическое, молча пропускаем тик.
      }
    };
    ping(); // сразу, не дожидаясь интервала
    const timer = setInterval(ping, HEARTBEAT_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  return null;
}
