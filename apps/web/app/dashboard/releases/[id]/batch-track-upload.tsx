'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { toast } from '@/lib/toast';
import { Icon } from '@/components/icon';

type ItemState = 'queued' | 'uploading' | 'processing' | 'error';

interface QueueItem {
  key: string;
  file: File;
  title: string;
  state: ItemState;
  progress: number;
  error?: string;
}

const ACCEPT_EXT = ['.wav', '.flac', '.mp3'];
const ACCEPT_ATTR = '.wav,.flac,.mp3,audio/wav,audio/x-wav,audio/flac,audio/x-flac,audio/mpeg';

function titleFromFilename(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAudioExt(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPT_EXT.some((e) => lower.endsWith(e));
}

let keySeq = 0;

export function BatchTrackUpload({
  releaseId,
  nextTrackNumber,
  artistName,
}: {
  releaseId: string;
  nextTrackNumber: number;
  artistName: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const activeXhrsRef = useRef<Set<XMLHttpRequest>>(new Set());
  const cancelledRef = useRef(false);

  // на анмаунте абортим XHR и стопим очередь — иначе цикл дёргает router.refresh() на другой странице
  useEffect(() => {
    const activeXhrs = activeXhrsRef.current;
    return () => {
      cancelledRef.current = true;
      for (const xhr of activeXhrs) xhr.abort();
      activeXhrs.clear();
    };
  }, []);

  const update = useCallback((key: string, patch: Partial<QueueItem>) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }, []);

  function uploadOne(item: QueueItem, trackNumber: number): Promise<boolean> {
    return new Promise((resolve) => {
      const fd = new FormData();
      fd.set('releaseId', releaseId);
      fd.set('title', item.title.trim() || item.file.name);
      fd.set('trackNumber', String(trackNumber));
      fd.set('credits', JSON.stringify([{ name: artistName, role: 'PERFORMER' }]));
      fd.set('file', item.file);

      const xhr = new XMLHttpRequest();
      activeXhrsRef.current.add(xhr);
      xhr.open('POST', '/api/v1/dashboard/tracks/upload');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) update(item.key, { progress: e.loaded / e.total });
      };
      xhr.onload = () => {
        activeXhrsRef.current.delete(xhr);
        if (xhr.status >= 200 && xhr.status < 300) {
          update(item.key, { state: 'processing', progress: 1 });
          resolve(true);
        } else {
          let msg = `Ошибка ${xhr.status}`;
          try { msg = JSON.parse(xhr.responseText).error ?? msg; } catch { /* keep */ }
          update(item.key, { state: 'error', error: msg });
          resolve(false);
        }
      };
      xhr.onerror = () => {
        activeXhrsRef.current.delete(xhr);
        update(item.key, { state: 'error', error: 'Сбой сети' });
        resolve(false);
      };
      xhr.onabort = () => {
        activeXhrsRef.current.delete(xhr);
        resolve(false);
      };
      update(item.key, { state: 'uploading', progress: 0 });
      xhr.send(fd);
    });
  }

  async function runQueue(queue: QueueItem[]) {
    if (uploading) return;
    setUploading(true);
    let ok = 0;
    let fail = 0;
    let n = nextTrackNumber;
    for (const item of queue) {
      if (cancelledRef.current) return;
      const success = await uploadOne(item, n);
      if (success) { ok += 1; n += 1; } else { fail += 1; }
    }
    if (cancelledRef.current) return;
    setUploading(false);

    if (ok > 0) {
      toast(`Загружено треков: ${ok}${fail ? `, с ошибкой: ${fail}` : ''}. Идёт обработка…`);
      router.refresh();
      setTimeout(() => {
        setItems((prev) => prev.filter((it) => it.state === 'error'));
      }, 1400);
    } else if (fail > 0) {
      toast.error(`Не удалось загрузить (${fail})`);
    }
  }

  function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    const accepted = files.filter((f) => hasAudioExt(f.name));
    const rejected = files.length - accepted.length;
    if (rejected > 0) {
      toast.error(`Пропущено файлов (не аудио): ${rejected}`);
    }
    if (accepted.length === 0) return;

    const newItems: QueueItem[] = accepted.map((file) => ({
      key: `f${keySeq++}`,
      file,
      title: titleFromFilename(file.name),
      state: 'queued',
      progress: 0,
    }));
    setItems((prev) => [...prev.filter((it) => it.state === 'error'), ...newItems]);
    void runQueue(newItems);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        disabled={uploading}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center transition-colors disabled:opacity-60 ${
          dragOver
            ? 'border-foreground/40 bg-foreground/10'
            : 'border-foreground/15 bg-foreground/[0.02] hover:bg-foreground/5 hover:border-foreground/25'
        }`}
      >
        <UploadIcon />
        <span className="text-sm text-foreground/70">
          {uploading ? 'Загрузка…' : 'Перетащи файлы сюда или нажми, чтобы выбрать'}
        </span>
        <span className="text-xs text-foreground/40">
          WAV, FLAC или MP3 · можно несколько сразу · автонумерация и исполнитель «{artistName}»
        </span>
        <span className="text-[11px] text-foreground/30 max-w-sm">
          Название трека — без имени артиста: оно и так показано рядом. Имя файла
          станет названием — переименуй ниже, если нужно.
        </span>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          hidden
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
        />
      </button>

      <AnimatePresence initial={false}>
        {items.map((it) => (
          <motion.div
            key={it.key}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring.snappy}
            className="rounded-lg border border-foreground/10 bg-foreground/[0.03] px-3 py-2.5"
          >
            <div className="flex items-center gap-3 text-sm">
              <StateDot state={it.state} />
              <span className="flex-1 min-w-0 truncate" title={it.file.name}>{it.title}</span>
              <span className={`shrink-0 text-xs font-mono ${
                it.state === 'error' ? 'text-red-400'
                : it.state === 'processing' ? 'text-yellow-400'
                : 'text-foreground/40'
              }`}>
                {it.state === 'queued' ? 'в очереди'
                  : it.state === 'uploading' ? `${Math.round(it.progress * 100)}%`
                  : it.state === 'processing' ? 'обрабатывается'
                  : 'ошибка'}
              </span>
            </div>

            {(it.state === 'uploading' || it.state === 'queued') && (
              <div className="mt-2 h-1 rounded-full bg-foreground/10 overflow-hidden">
                <motion.div
                  className="h-full bg-foreground/60"
                  initial={false}
                  animate={{ width: `${Math.round(it.progress * 100)}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
            )}

            {it.state === 'error' && it.error && (
              <p className="mt-1.5 text-xs text-red-400">{it.error}</p>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function StateDot({ state }: { state: ItemState }) {
  const cls =
    state === 'error' ? 'bg-red-400'
    : state === 'processing' ? 'bg-yellow-400'
    : state === 'uploading' ? 'bg-foreground/70'
    : 'bg-foreground/30';
  return (
    <span className="shrink-0 relative grid place-items-center w-4 h-4">
      <span className={`w-2 h-2 rounded-full ${cls}`} />
      {(state === 'uploading' || state === 'processing') && (
        <span className={`absolute inset-0 rounded-full animate-ping ${cls} opacity-40`} />
      )}
    </span>
  );
}

function UploadIcon() {
  return <Icon name="upload" size={22} className="text-foreground/50" />;
}
