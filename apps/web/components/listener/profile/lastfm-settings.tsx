'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from '@/lib/toast';

const LASTFM_USERNAME_RE = /^[a-zA-Z0-9_.-]{2,64}$/;

export function LastfmSettings({ initial }: { initial: string | null }) {
  const t = useTranslations('profile.lastfmSettings');
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial ?? '');
  const [pending, setPending] = useState(false);

  const trimmed = draft.trim();
  const valid = trimmed === '' || LASTFM_USERNAME_RE.test(trimmed);
  const dirty = trimmed !== (saved ?? '');
  const willUnlink = trimmed === '' && saved !== null;

  async function save() {
    if (!valid || !dirty || pending) return;
    setPending(true);
    const next = trimmed === '' ? null : trimmed;
    try {
      const res = await fetch('/api/v1/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastfmUsername: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(next);
      setDraft(next ?? '');
    } catch {
      toast.error(t('saveFailed'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card/60 px-4 py-3.5 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium">Last.fm</p>
        <span
          className={
            saved
              ? 'text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-500/12 text-green-500'
              : 'text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground'
          }
        >
          {saved ? t('linked') : t('notLinked')}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('description')}
      </p>
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void save(); }}
          placeholder={t('usernamePlaceholder')}
          maxLength={64}
          aria-label={t('usernameAriaLabel')}
          className="flex-1 min-w-0 min-h-11 rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          onClick={save}
          disabled={!valid || !dirty || pending}
          className="shrink-0 min-h-11 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground px-4 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {pending ? '…' : willUnlink ? t('unlink') : t('save')}
        </button>
      </div>
      {!valid && trimmed !== '' && (
        <p className="text-xs text-red-400">{t('invalidFormat')}</p>
      )}
    </div>
  );
}
