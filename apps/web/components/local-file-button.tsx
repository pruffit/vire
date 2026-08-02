'use client';
import { useRef, useState } from 'react';
import { Icon } from '@/components/icon';
import { hasFileSystemAccess, pickLocalFile, registerLocalFile, getLocalFile } from '@/lib/local-files';
import { titleFromFileName } from '@/lib/player/local-file-track';
import { cn } from '@/lib/utils';

interface Props {
  onPick: (file: { id: string; title: string; durationSec: number | null }) => void;
  className?: string;
}

function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    const done = (sec: number | null) => {
      URL.revokeObjectURL(url);
      resolve(sec);
    };
    audio.addEventListener('loadedmetadata', () => done(Number.isFinite(audio.duration) ? Math.round(audio.duration) : null), { once: true });
    audio.addEventListener('error', () => done(null), { once: true });
    audio.src = url;
  });
}

/** Файл с устройства слушателя, на сервер не уходит (см. lib/local-files.ts). Общая кнопка вечеринки (колонка) и очереди глобального плеера. */
export function LocalFileButton({ onPick, className }: Props) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleClick(): Promise<void> {
    if (busy) return;
    if (hasFileSystemAccess()) {
      setBusy(true);
      const picked = await pickLocalFile();
      setBusy(false);
      if (!picked) return;
      const file = getLocalFile(picked.id);
      const durationSec = file ? await readDuration(file) : null;
      onPick({ id: picked.id, title: titleFromFileName(picked.name), durationSec });
      return;
    }
    inputRef.current?.click();
  }

  async function handleInputChange(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    const id = registerLocalFile(file);
    const durationSec = await readDuration(file);
    setBusy(false);
    onPick({ id, title: titleFromFileName(file.name), durationSec });
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => void handleInputChange(e)} />
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={busy}
        className={cn(
          'inline-flex items-center gap-1.5 min-h-11 rounded-full border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50',
          className,
        )}
      >
        {busy ? <Icon name="loader" size={14} className="animate-spin" /> : <Icon name="file-plus" size={14} />}
        Файл с устройства
      </button>
    </>
  );
}
