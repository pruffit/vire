'use client';

import { useCallback, useRef, useState } from 'react';
import { useIdentity } from '@/lib/e2ee-client';
import { useRealtime } from '@/lib/use-realtime';
import {
  newEphemeral, deriveLinkSecret, sasDigits6, wrapPriv, unwrapPriv, hashCommit, commitMatches,
  importIdentity, toB64, fromB64,
} from '@/lib/e2ee';

interface LinkState {
  userId: string;
  commitB: string;
  eaPub?: string;
  ebPub?: string;
  wrapped?: string;
  nonce?: string;
  status: 'pending' | 'completed';
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function poll(linkId: string, until: (s: LinkState) => boolean): Promise<LinkState | null> {
  for (let i = 0; i < 120; i++) {
    const res = await fetch(`/api/v1/keys/link/poll?linkId=${linkId}`).catch(() => null);
    if (res?.ok) {
      const state = (await res.json()) as LinkState;
      if (until(state)) return state;
    }
    await sleep(1500);
  }
  return null;
}

function post(path: string, body: unknown) {
  return fetch(`/api/v1/keys/link/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

export function DeviceLink({ viewerId }: { viewerId: string }) {
  const identity = useIdentity(viewerId);
  const [code, setCode] = useState<string | null>(null); // код, показываемый новым устройством
  const [approve, setApprove] = useState<{ linkId: string; expected: string; secret: Uint8Array } | null>(null);
  const [typed, setTyped] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const busy = useRef(false);

  // Новое устройство (B): commit(ebPub) → attach ожидание → reveal(ebPub) → показ SAS → ожидание wrapped.
  const startNew = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setMsg(null);
    try {
      const eB = newEphemeral();
      const startRes = await post('start', { commit: hashCommit(eB.pub) });
      if (!startRes.ok) throw new Error();
      const { linkId } = (await startRes.json()) as { linkId: string };

      const attached = await poll(linkId, (s) => !!s.eaPub);
      if (!attached?.eaPub) throw new Error();

      const revealRes = await post('reveal', { linkId, ebPub: toB64(eB.pub) });
      if (!revealRes.ok) throw new Error();

      const secret = deriveLinkSecret(eB.priv, fromB64(attached.eaPub));
      setCode(sasDigits6(eB.pub, fromB64(attached.eaPub), secret));

      const completed = await poll(linkId, (s) => !!s.wrapped);
      if (!completed?.wrapped || !completed.nonce) throw new Error();
      const priv = unwrapPriv(completed.wrapped, completed.nonce, secret);
      if (!priv) throw new Error();
      await importIdentity(priv);
      window.location.reload();
    } catch {
      setMsg('Не удалось привязать устройство. Попробуйте снова.');
      setCode(null);
    } finally {
      busy.current = false;
    }
  }, []);

  // Существующее устройство (A): attach(eaPub) видя только commit → ждёт ebPub → проверяет commit → SAS.
  const onLinkRequest = useCallback(async (linkId: string) => {
    if (!identity.priv || identity.needsLink || approve) return;
    const first = await poll(linkId, (s) => !!s.commitB && !s.eaPub);
    if (!first?.commitB) return;

    const eA = newEphemeral();
    const attachRes = await post('attach', { linkId, eaPub: toB64(eA.pub) });
    if (!attachRes.ok) return;

    const revealed = await poll(linkId, (s) => !!s.ebPub);
    if (!revealed?.ebPub) return;

    // Загрузочная проверка против MITM: ebPub обязан соответствовать коммитменту, сделанному до attach.
    if (!commitMatches(fromB64(revealed.ebPub), first.commitB)) {
      setMsg('Привязка отклонена: не сошёлся ключ (возможна подмена).');
      return;
    }

    const secret = deriveLinkSecret(eA.priv, fromB64(revealed.ebPub));
    const expected = sasDigits6(fromB64(revealed.ebPub), eA.pub, secret);
    setApprove({ linkId, expected, secret });
  }, [identity.priv, identity.needsLink, approve]);

  useRealtime({
    'link-request': (event) => {
      const linkId = event.linkId as string | undefined;
      if (linkId) void onLinkRequest(linkId);
    },
  });

  async function confirmApprove() {
    if (!approve || !identity.priv) return;
    if (typed.trim() !== approve.expected) {
      setMsg('Код не совпадает. Привязка отменена.');
      setApprove(null);
      setTyped('');
      return;
    }
    const { wrapped, nonce } = wrapPriv(identity.priv, approve.secret);
    await post('complete', { linkId: approve.linkId, wrapped, nonce });
    setApprove(null);
    setTyped('');
    setMsg('Устройство привязано.');
  }

  if (!identity.ready) return null;

  if (approve) {
    return (
      <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
        <p className="text-sm font-medium">Новое устройство хочет доступ к переписке</p>
        <p className="text-xs text-muted-foreground">Введите 6-значный код, показанный на новом устройстве.</p>
        <input
          inputMode="numeric" maxLength={6} value={typed}
          onChange={(e) => setTyped(e.target.value.replace(/\D/g, ''))}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-center font-mono text-lg tracking-widest outline-none focus:border-ring"
          placeholder="______"
        />
        <div className="flex gap-2">
          <button onClick={confirmApprove} disabled={typed.length !== 6}
            className="min-h-11 flex-1 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-40">
            Подтвердить
          </button>
          <button onClick={() => { setApprove(null); setTyped(''); }}
            className="min-h-11 rounded-lg border border-border px-4 text-sm">Отмена</button>
        </div>
      </div>
    );
  }

  if (identity.needsLink) {
    return (
      <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
        {code ? (
          <>
            <p className="text-sm font-medium">Код для привязки</p>
            <p className="text-center font-mono text-3xl tracking-[0.3em]">{code}</p>
            <p className="text-xs text-muted-foreground">Введите этот код на своём уже настроенном устройстве.</p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">Переписка зашифрована на этом устройстве</p>
            <p className="text-xs text-muted-foreground">
              Чтобы читать историю, подтвердите это устройство на другом своём устройстве, где уже открыт Vire.
            </p>
            <button onClick={startNew}
              className="min-h-11 w-full rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
              Привязать это устройство
            </button>
          </>
        )}
        {msg && <p className="text-xs text-destructive">{msg}</p>}
      </div>
    );
  }

  return msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null;
}
