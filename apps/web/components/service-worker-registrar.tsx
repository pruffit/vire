'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { purgeOfflineLibrary } from '@/lib/offline/db';
import { getSavedOwner, setSavedOwner, shouldPurge } from '@/lib/offline/owner';

export function ServiceWorkerRegistrar({ userId }: { userId?: string | null }) {
  const router = useRouter();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;
    let listenerAdded = false;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
        if (cancelled) return;
        const sw = reg.active ?? reg.waiting ?? reg.installing;
        sw?.postMessage({ type: 'SET_OWNER', id: userId ?? null });
        // SW прекэширует только HTML /offline — её JS-чанки попадают в кэш статики,
        // только если хоть раз запрошены; без прогрева первая офлайн-навигация не оживёт.
        router.prefetch('/offline');
      } catch (err) {
        console.error('sw: register failed', err);
      }
    };

    const start = () => {
      // 'load' уже мог случиться до маунта (клиентская навигация) — тогда регистрируем сразу.
      if (document.readyState === 'complete') {
        register();
      } else {
        listenerAdded = true;
        window.addEventListener('load', register);
      }
    };

    // Офлайн-медиатека принадлежит аккаунту: IndexedDB/Cache Storage общие на браузер,
    // поэтому владелец сверяется здесь (на клиенте, где известен userId), не в SW.
    const currentOwner = userId ?? 'anon';
    const afterOwnerCheck = () => {
      if (cancelled) return;
      setSavedOwner(currentOwner);
      start();
    };
    if (shouldPurge(getSavedOwner(), currentOwner)) {
      purgeOfflineLibrary().catch((err) => console.error('offline: purge failed', err)).finally(afterOwnerCheck);
    } else {
      afterOwnerCheck();
    }

    return () => {
      cancelled = true;
      if (listenerAdded) window.removeEventListener('load', register);
    };
  }, [userId, router]);

  return null;
}
