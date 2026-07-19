'use client';

import { useCallback, useRef, useState } from 'react';
import { useIdentity } from '@/lib/e2ee-client';
import { useRealtime } from '@/lib/use-realtime';
import {
  newEphemeral, deriveLinkSecret, sasDigits6, wrapPriv, unwrapPriv, importIdentity, toB64, fromB64,
} from '@/lib/e2ee';

interface LinkState {
  userId: string;
  ebPub: string;
  eaPub?: string;
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

export function DeviceLink({ viewerId }: { viewerId: string }) {
  const identity = useIdentity(viewerId);
  const [code, setCode] = useState<string | null>(null); // код, показываемый новым устройством
  const [approve, setApprove] = useState<{ linkId: string; expected: string; secret: Uint8Array } | null>(null);
  const [typed, setTyped] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const busy = useRef(false);

  // Новое устройство: старт привязки, показ SAS, ожидание завёрнутого ключа.
  const startNew = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setMsg(null);
    try {
      const eB = newEphemeral();
      const startRes = await fetch('/api/v1/keys/link/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ebPub: toB64(eB.pub) }),
      });
      if (!startRes.ok) throw new Error();
      const { linkId } = (await startRes.json()) as { linkId: string };

      const attached = await poll(linkId, (s) => !!s.eaPub);
      if (!attached?.eaPub) throw new Error();
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

  // Существующее устройство: подтверждает запрос привязки, кладёт eaPub, ждёт ввод SAS-кода.
  const onLinkRequest = useCallback(async (linkId: string) => {
    if (!identity.priv || identity.needsLink || approve) return;
    const state = await poll(linkId, (s) => !!s.ebPub);
    if (!state?.ebPub) return;
    const eA = newEphemeral();
    const secret = deriveLinkSecret(eA.priv, fromB64(state.ebPub));
    const expected = sasDigits6(fromB64(state.ebPub), eA.pub, secret);
    const res = await fetch('/api/v1/keys/link/attach', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkId, eaPub: toB64(eA.pub) }),
    });
    if (res.ok) setApprove({ linkId, expected, secret });
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
    await fetch('/api/v1/keys/link/complete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkId: approve.linkId, wrapped, nonce }),
    });
    setApprove(null);
    setTyped('');
    setMsg('Устройство привязано.');
  }

  if (!identity.ready) return null;

  // Существующее устройство подтверждает новое.
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

  // Новое устройство: кнопка старта / показ кода.
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
