'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useIdentity } from '@/lib/e2ee-client';
import {
  newEphemeral, deriveLinkSecret, sasDigits6, unwrapPriv, hashCommit,
  importIdentity, resetIdentity, toB64, fromB64,
} from '@/lib/e2ee';
import { pollLink, postLink } from './link-protocol';

// Новое устройство (B): commit(ebPub) → attach ожидание → reveal(ebPub) → показ SAS → ожидание wrapped.
export function DeviceLink({ viewerId }: { viewerId: string }) {
  const t = useTranslations('chat.deviceLink');
  const identity = useIdentity(viewerId);
  const [linkId, setLinkId] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const busy = useRef(false);
  const cancelled = useRef(false);

  const startNew = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    cancelled.current = false;
    setMsg(null);
    try {
      const eB = newEphemeral();
      const startRes = await postLink('start', { commit: hashCommit(eB.pub) });
      if (!startRes.ok) throw new Error();
      const { linkId: id } = (await startRes.json()) as { linkId: string };
      setLinkId(id);

      const attached = await pollLink(id, (s) => !!s.eaPub);
      if (cancelled.current) return;
      if (attached === 'gone') { setLinkId(null); setMsg(t('rejectedElsewhere')); return; }
      if (!attached?.eaPub) throw new Error();

      const revealRes = await postLink('reveal', { linkId: id, ebPub: toB64(eB.pub) });
      if (!revealRes.ok) throw new Error();

      const secret = deriveLinkSecret(eB.priv, fromB64(attached.eaPub));
      setCode(sasDigits6(eB.pub, fromB64(attached.eaPub), secret));

      const completed = await pollLink(id, (s) => !!s.wrapped);
      if (cancelled.current) return;
      if (completed === 'gone') { setLinkId(null); setCode(null); setMsg(t('rejectedElsewhere')); return; }
      if (!completed?.wrapped || !completed.nonce) throw new Error();
      const priv = unwrapPriv(completed.wrapped, completed.nonce, secret);
      if (!priv) throw new Error();
      await importIdentity(viewerId, priv);
      window.location.reload();
    } catch {
      if (!cancelled.current) setMsg(t('linkFailed'));
      setLinkId(null);
      setCode(null);
    } finally {
      busy.current = false;
    }
  }, [viewerId, t]);

  function cancelLinking() {
    cancelled.current = true;
    if (linkId) void postLink('abort', { linkId });
    setLinkId(null);
    setCode(null);
  }

  async function handleReset() {
    setResetting(true);
    try {
      const created = await resetIdentity(viewerId);
      await fetch('/api/v1/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ikPub: toB64(created.pub) }),
      });
      window.location.reload();
    } catch {
      setResetting(false);
      setConfirmingReset(false);
      setMsg(t('resetFailed'));
    }
  }

  if (!identity.ready) return null;

  if (identity.needsLink) {
    return (
      <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
        {code ? (
          <>
            <p className="text-sm font-medium">{t('linkTitle')}</p>
            <p className="text-center font-mono text-3xl tracking-[0.3em]">{code}</p>
            <p className="text-xs text-muted-foreground">{t('linkHint')}</p>
            <button onClick={cancelLinking} className="min-h-11 w-full rounded-lg border border-border px-4 text-sm">
              {t('cancel')}
            </button>
          </>
        ) : linkId ? (
          <>
            <p className="text-sm font-medium">{t('waitingTitle')}</p>
            <p className="text-xs text-muted-foreground">
              {t('waitingHint')}
            </p>
            <button onClick={cancelLinking} className="min-h-11 w-full rounded-lg border border-border px-4 text-sm">
              {t('cancel')}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">{t('promptTitle')}</p>
            <p className="text-xs text-muted-foreground">
              {t('promptHint')}
            </p>
            <button onClick={startNew}
              className="min-h-11 w-full rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
              {t('linkButton')}
            </button>
            {confirmingReset ? (
              <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs text-destructive">
                  {t('resetWarning')}
                </p>
                <div className="flex gap-2">
                  <button onClick={handleReset} disabled={resetting}
                    className="min-h-9 flex-1 rounded-lg bg-destructive px-3 text-xs font-medium text-foreground disabled:opacity-40">
                    {resetting ? t('resetting') : t('resetConfirm')}
                  </button>
                  <button onClick={() => setConfirmingReset(false)} disabled={resetting}
                    className="min-h-9 rounded-lg border border-border px-3 text-xs">
                    {t('cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmingReset(true)}
                className="w-full text-center text-xs text-muted-foreground underline hover:text-destructive">
                {t('resetPrompt')}
              </button>
            )}
          </>
        )}
        {msg && <p className="text-xs text-destructive">{msg}</p>}
      </div>
    );
  }

  return msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null;
}
