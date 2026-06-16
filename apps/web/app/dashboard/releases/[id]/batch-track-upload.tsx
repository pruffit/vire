'use client';

import { useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { toast } from '@/components/toast';
import { Icon } from '@/components/icon';

type ItemState = 'queued' | 'uploading' | 'processing' | 'error';

interface QueueItem {
  key: string;
  file: File;
  title: string;
  state: ItemState;
  progress: number; // 0..1 (upload)
  error?: string;
}

const ACCEPT_EXT = ['.wav', '.flac', '.mp3'];
const ACCEPT_ATTR = '.wav,.flac,.mp3,audio/wav,audio/x-wav,audio/flac,audio/x-flac,audio/mpeg';

/** «my_track 01.wav» → «my track 01» (без расширения, подчёркивания → пробелы). */
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
      xhr.open('POST', '/api/v1/dashboard/tracks/upload');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) update(item.key, { progress: e.loaded / e.total });
      };
      xhr.onload = () => {
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
        update(item.key, { state: 'error', error: 'Сбой сети' });
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
    // Нумеруем последовательно от текущего «следующего» номера; неуспешные пропускаем.
    let n = nextTrackNumber;
    for (const item of queue) {
      const success = await uploadOne(item, n);
      if (success) { ok += 1; n += 1; } else { fail += 1; }
    }
    setUploading(false);

    if (ok > 0) {
      toast(`Загружено треков: ${ok}${fail ? `, с ошибкой: ${fail}` : ''}. Идёт обработка…`);
      // Обновляем серверный список — новые треки появятся в менеджере с live-статусом.
      router.refresh();
      // Успешные строки убираем, ошибки оставляем перед глазами.
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
      {/* Dropzone */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        disabled={uploading}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center transition-colors disabled:opacity-60 ${
          dragOver
            ? 'border-white/40 bg-white/10'
            : 'border-white/15 bg-white/[0.02] hover:bg-white/5 hover:border-white/25'
        }`}
      >
        <UploadIcon />
        <span className="text-sm text-white/70">
          {uploading ? 'Загрузка…' : 'Перетащи файлы сюда или нажми, чтобы выбрать'}
        </span>
        <span className="text-xs text-white/40">
          WAV, FLAC или MP3 · можно несколько сразу · автонумерация и исполнитель «{artistName}»
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

      {/* Очередь */}
      <AnimatePresence initial={false}>
        {items.map((it) => (
          <motion.div
            key={it.key}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring.snappy}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5"
          >
            <div className="flex items-center gap-3 text-sm">
              <StateDot state={it.state} />
              <span className="flex-1 min-w-0 truncate" title={it.file.name}>{it.title}</span>
              <span className={`shrink-0 text-xs font-mono ${
                it.state === 'error' ? 'text-red-400'
                : it.state === 'processing' ? 'text-yellow-400'
                : 'text-white/40'
              }`}>
                {it.state === 'queued' ? 'в очереди'
                  : it.state === 'uploading' ? `${Math.round(it.progress * 100)}%`
                  : it.state === 'processing' ? 'обрабатывается'
                  : 'ошибка'}
              </span>
            </div>

            {/* Прогресс-бар */}
            {(it.state === 'uploading' || it.state === 'queued') && (
              <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full bg-white/60"
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
    : state === 'uploading' ? 'bg-white/70'
    : 'bg-white/30';
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
  return <Icon name="upload" size={22} className="text-white/50" />;
}
