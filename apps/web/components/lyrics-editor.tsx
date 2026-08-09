'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from '@/lib/toast';
import { Textarea } from '@/components/ui-kit';
import { parseLrc, serializeLrc, isSynced, type LyricLine } from '@/lib/lrc';

/** Редактор текста трека: LRC (`[мм:сс.хх] строка`) или простой текст; парсит сервер. */
export function LyricsEditor({ trackId, initial }: { trackId: string; initial: LyricLine[] | null }) {
  const t = useTranslations('dashboard.lyricsEditor');
  const [text, setText] = useState(() => serializeLrc(initial));
  const [saved, setSaved] = useState(() => serializeLrc(initial));
  const [busy, setBusy] = useState(false);

  const parsed = parseLrc(text);
  const synced = isSynced(parsed);
  const dirty = text.trim() !== saved.trim();

  async function save() {
    setBusy(true);
    const res = await fetch(`/api/v1/dashboard/tracks/${trackId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lyrics: text }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setSaved(text);
      toast(text.trim() ? t('saved') : t('deleted'));
    } else {
      toast.error(t('saveFailed'));
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-foreground/60">{t('heading')}</span>
        <span className="text-[11px] text-foreground/30 font-mono">
          {synced ? t('synced') : t('unsynced')}
        </span>
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={busy}
        rows={5}
        spellCheck={false}
        placeholder={t('placeholder')}
        className="w-full rounded-lg bg-transparent border border-foreground/10 px-3 py-2 text-xs font-mono leading-relaxed text-foreground/80 placeholder:text-foreground/25 focus:outline-none focus:ring-1 focus:ring-ring resize-y disabled:opacity-50"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-foreground/30">
          {parsed.length > 0 ? t('lineCount', { count: parsed.length }) : t('formatHint')}
        </span>
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty}
          className="shrink-0 rounded-full bg-foreground/10 px-3 py-1 text-xs font-medium text-foreground/80 hover:bg-foreground/15 disabled:opacity-30 disabled:cursor-not-allowed transition-colors pointer-coarse:min-h-11 pointer-coarse:inline-flex pointer-coarse:items-center"
        >
          {busy ? t('saving') : t('save')}
        </button>
      </div>
    </div>
  );
}
