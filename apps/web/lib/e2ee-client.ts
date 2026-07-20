'use client';

import { useEffect, useState } from 'react';
import { sodiumReady, getIdentity, getOrCreateIdentity, getIdentityPubB64, toB64, fromB64 } from './e2ee';

export interface IdentityState {
  ready: boolean;
  pub: Uint8Array | null;
  priv: Uint8Array | null;
  needsLink: boolean;
  error: boolean;
}

const IDLE_STATE: IdentityState = { ready: false, pub: null, priv: null, needsLink: false, error: false };
const ERROR_STATE: IdentityState = { ready: false, pub: null, priv: null, needsLink: false, error: true };

const publishedPub = new Set<string>();
const bootstraps = new Map<string, Promise<IdentityState>>();

async function publishPub(selfId: string, pubB64: string): Promise<void> {
  const dedupeKey = `${selfId}:${pubB64}`;
  if (publishedPub.has(dedupeKey)) return;
  publishedPub.add(dedupeKey);
  const ok = await fetch('/api/v1/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ikPub: pubB64 }),
  }).then((res) => res.ok).catch(() => false);
  if (!ok) publishedPub.delete(dedupeKey);
}

// Бутстрап личности: локальный ключ → используем; нет локального, но есть серверный (другое
// устройство завело личность) → needsLink (читать нельзя без привязки); нет нигде → первое устройство.
async function bootstrapIdentity(selfId: string): Promise<IdentityState> {
  await sodiumReady();
  const local = await getIdentity(selfId);
  if (local) {
    const pubB64 = await getIdentityPubB64(selfId);
    if (pubB64) await publishPub(selfId, pubB64);
    return { ready: true, pub: local.pub, priv: local.priv, needsLink: false, error: false };
  }

  // Нет локального ключа: НЕ создаём новую личность на транзиентной ошибке сети — иначе
  // перезатёрли бы серверный ikPub и осиротили другое устройство (вся история нечитаема).
  const res = await fetch(`/api/v1/keys?userId=${selfId}`).catch(() => null);
  if (!res || !res.ok) return { ready: false, pub: null, priv: null, needsLink: false, error: true };
  const { ikPub } = (await res.json()) as { ikPub: string | null };

  if (ikPub) return { ready: true, pub: fromB64(ikPub), priv: null, needsLink: true, error: false };

  const created = await getOrCreateIdentity(selfId);
  await publishPub(selfId, toB64(created.pub));
  return { ready: true, pub: created.pub, priv: created.priv, needsLink: false, error: false };
}

// Singleton по selfId: до трёх компонентов вызывают useIdentity на одном заходе на /messages,
// без этого — до 3 POST /api/v1/keys. Ошибочный результат не кешируется — следующий монтаж повторит.
function getBootstrap(selfId: string): Promise<IdentityState> {
  const cached = bootstraps.get(selfId);
  if (cached) return cached;

  // catch обязателен: заблокированный IndexedDB (приватный режим, квота) бросает, а не резолвит
  // error-состояние — без него отклонённый промис залипал бы в кеше на весь таб.
  const started = bootstrapIdentity(selfId)
    .catch(() => ERROR_STATE)
    .then((result) => {
      if (result.error) bootstraps.delete(selfId);
      return result;
    });
  bootstraps.set(selfId, started);
  return started;
}

export function useIdentity(selfId: string): IdentityState {
  const [state, setState] = useState<IdentityState>(IDLE_STATE);

  useEffect(() => {
    let mounted = true;
    getBootstrap(selfId).then((result) => {
      if (mounted) setState(result);
    });
    return () => {
      mounted = false;
    };
  }, [selfId]);

  return state;
}
