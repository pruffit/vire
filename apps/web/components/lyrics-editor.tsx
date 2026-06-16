'use client';

import { useState } from 'react';
import { toast } from '@/components/toast';
import { parseLrc, serializeLrc, isSynced, type LyricLine } from '@/lib/lrc';

/**
 * Редактор текста трека для дашборда. Артист вставляет LRC
 * (`[мм:сс.хх] строка`) или просто текст. Сохраняем сырой ввод через PATCH —
 * сервер парсит в строки. Синхронизированный текст плеер подсветит по времени.
 */
export function LyricsEditor({ trackId, initial }: { trackId: string; initial: LyricLine[] | null }) {
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
      toast(text.trim() ? 'Текст сохранён' : 'Текст удалён');
    } else {
      toast.error('Не удалось сохранить текст');
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-white/60">Текст трека</span>
        <span className="text-[11px] text-white/30 font-mono">
          {synced ? 'синхронизирован' : 'без таймкодов'}
        </span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={busy}
        rows={5}
        spellCheck={false}
        placeholder={'[00:12.50] Первая строка\n[00:16.00] Вторая строка\n\nили просто текст без таймкодов'}
        className="w-full rounded-lg bg-transparent border border-white/10 px-3 py-2 text-xs font-mono leading-relaxed text-white/80 placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-white/30 resize-y disabled:opacity-50"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-white/30">
          {parsed.length > 0 ? `${parsed.length} строк · формат LRC [мм:сс.хх]` : 'Формат LRC: [мм:сс.хх] строка'}
        </span>
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty}
          className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {busy ? 'Сохранение…' : 'Сохранить текст'}
        </button>
      </div>
    </div>
  );
}
