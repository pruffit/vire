'use client';

import { useEffect, useRef, useState } from 'react';
import { sodiumReady, getIdentity, getOrCreateIdentity, getIdentityPubB64, toB64, fromB64 } from './e2ee';

export interface IdentityState {
  ready: boolean;
  pub: Uint8Array | null;
  priv: Uint8Array | null;
  needsLink: boolean;
}

async function publishPub(pubB64: string): Promise<void> {
  await fetch('/api/v1/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ikPub: pubB64 }),
  }).catch(() => {});
}

// Бутстрап личности: локальный ключ → используем; нет локального, но есть серверный (другое
// устройство завело личность) → needsLink (читать нельзя без привязки); нет нигде → первое устройство.
export function useIdentity(selfId: string): IdentityState {
  const [state, setState] = useState<IdentityState>({ ready: false, pub: null, priv: null, needsLink: false });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      await sodiumReady();
      const local = await getIdentity();
      if (local) {
        const pubB64 = await getIdentityPubB64();
        if (pubB64) await publishPub(pubB64);
        setState({ ready: true, pub: local.pub, priv: local.priv, needsLink: false });
        return;
      }

      const remote = await fetch(`/api/v1/keys?userId=${selfId}`)
        .then((r) => (r.ok ? (r.json() as Promise<{ ikPub: string | null }>) : { ikPub: null }))
        .catch(() => ({ ikPub: null }));

      if (remote.ikPub) {
        setState({ ready: true, pub: fromB64(remote.ikPub), priv: null, needsLink: true });
        return;
      }

      const created = await getOrCreateIdentity();
      await publishPub(toB64(created.pub));
      setState({ ready: true, pub: created.pub, priv: created.priv, needsLink: false });
    })();
  }, [selfId]);

  return state;
}
