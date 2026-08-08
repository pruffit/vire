'use client';

import { useCallback, useState } from 'react';
import { useIdentity } from '@/lib/e2ee-client';
import { useRealtime } from '@/lib/use-realtime';
import { newEphemeral, deriveLinkSecret, sasDigits6, wrapPriv, commitMatches, toB64, fromB64 } from '@/lib/e2ee';
import { isLinkState, pollLink, postLink } from './link-protocol';

export function LinkApprove({ viewerId }: { viewerId: string }) {
  const identity = useIdentity(viewerId);
  const [approve, setApprove] = useState<{ linkId: string; expected: string; secret: Uint8Array } | null>(null);
  const [typed, setTyped] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  // Существующее устройство (A): attach(eaPub) видя только commit → ждёт ebPub → проверяет commit → SAS.
  const onLinkRequest = useCallback(async (linkId: string) => {
    if (!identity.priv || identity.needsLink || approve) return;
    const first = await pollLink(linkId, (s) => !!s.commitB && !s.eaPub);
    if (!isLinkState(first) || !first.commitB) return;

    const eA = newEphemeral();
    const attachRes = await postLink('attach', { linkId, eaPub: toB64(eA.pub) });
    if (!attachRes.ok) return;

    const revealed = await pollLink(linkId, (s) => !!s.ebPub);
    if (!isLinkState(revealed) || !revealed.ebPub) return;

    // Загрузочная проверка против MITM: ebPub обязан соответствовать коммитменту, сделанному до attach.
    if (!commitMatches(fromB64(revealed.ebPub), first.commitB)) {
      await postLink('abort', { linkId });
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
      await postLink('abort', { linkId: approve.linkId });
      setMsg('Код не совпадает. Привязка отменена.');
      setApprove(null);
      setTyped('');
      return;
    }
    const { wrapped, nonce } = wrapPriv(identity.priv, approve.secret);
    await postLink('complete', { linkId: approve.linkId, wrapped, nonce });
    setApprove(null);
    setTyped('');
    setMsg('Устройство привязано.');
  }

  if (!identity.ready || !identity.priv || (!approve && !msg)) return null;

  return (
    <div className="fixed bottom-20 right-4 z-[55] w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card/95 p-4 shadow-2xl shadow-background/40 backdrop-blur-xl space-y-3 md:bottom-6">
      {approve ? (
        <>
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
            <button onClick={() => { void postLink('abort', { linkId: approve.linkId }); setApprove(null); setTyped(''); }}
              className="min-h-11 rounded-lg border border-border px-4 text-sm">Отмена</button>
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{msg}</p>
      )}
    </div>
  );
}
