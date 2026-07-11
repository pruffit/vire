'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from '@/components/toast';
import { Icon } from '@/components/icon';

interface PlaylistMeta {
  id: string;
  title: string;
  description: string | null;
  visibility: 'PRIVATE' | 'PUBLIC';
  coverUrl: string | null;
}

interface Props {
  playlist: PlaylistMeta;
}

interface CoverSectionProps {
  /** Guaranteed non-null: either a blob: preview URL or the saved S3 URL. */
  src: string;
  onPickFile: () => void;
  onRemove: () => void;
}

function CoverPreview({ src, onPickFile, onRemove }: CoverSectionProps) {
  const isBlob = src.startsWith('blob:');
  return (
    <div className="flex items-center gap-2">
      {isBlob ? (
        /* blob: next/image не оптимизирует blob: */
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="Обложка" className="w-10 h-10 rounded-md object-cover border border-border shrink-0" />
      ) : (
        <Image src={src} alt="Обложка" width={40} height={40} className="rounded-md object-cover border border-border shrink-0" />
      )}
      <button
        onClick={onPickFile}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-secondary"
      >
        <Icon name="upload" size={13} /> Заменить
      </button>
      <button
        onClick={onRemove}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-md hover:bg-secondary"
      >
        <Icon name="x" size={12} /> Убрать
      </button>
    </div>
  );
}

export function PlaylistSettingsMenu({ playlist }: Props) {
  const { id, visibility } = playlist;
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(playlist.title);
  const [description, setDescription] = useState(playlist.description ?? '');
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const blobPreviewRef = useRef<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    return () => { if (blobPreviewRef.current) URL.revokeObjectURL(blobPreviewRef.current); };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  async function saveTitle() {
    if (!title.trim() || title === playlist.title) return;
    const res = await fetch(`/api/v1/playlists/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim() }),
    }).catch(() => null);
    if (!res?.ok) { toast.error('Не удалось переименовать'); return; }
    toast('Название сохранено');
    router.refresh();
  }

  async function saveDescription() {
    const res = await fetch(`/api/v1/playlists/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: description.trim() || null }),
    }).catch(() => null);
    if (!res?.ok) { toast.error('Не удалось сохранить описание'); return; }
    toast('Описание сохранено');
    router.refresh();
  }

  async function setVisibility(v: 'PRIVATE' | 'PUBLIC') {
    const res = await fetch(`/api/v1/playlists/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility: v }),
    }).catch(() => null);
    if (!res?.ok) { toast.error('Не удалось изменить доступ'); return; }
    router.refresh();
  }

  async function uploadCover(file: File) {
    const fd = new FormData();
    fd.append('cover', file);
    const res = await fetch(`/api/v1/playlists/${id}/cover`, { method: 'POST', body: fd }).catch(() => null);
    const data = res?.ok ? await res.json() : null;
    if (!data) { toast.error('Не удалось загрузить обложку'); return; }
    toast('Обложка обновлена');
    router.refresh();
  }

  async function removeCover() {
    const fd = new FormData();
    fd.append('removeCover', '1');
    const res = await fetch(`/api/v1/playlists/${id}/cover`, { method: 'POST', body: fd }).catch(() => null);
    if (!res?.ok) { toast.error('Не удалось убрать обложку'); return; }
    if (blobPreviewRef.current) { URL.revokeObjectURL(blobPreviewRef.current); blobPreviewRef.current = null; }
    setCoverPreview(null);
    toast('Обложка удалена');
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm('Удалить плейлист?')) return;
    const res = await fetch(`/api/v1/playlists/${id}`, { method: 'DELETE' }).catch(() => null);
    if (!res?.ok) { toast.error('Не удалось удалить плейлист'); return; }
    router.push('/profile');
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (blobPreviewRef.current) URL.revokeObjectURL(blobPreviewRef.current);
    const url = URL.createObjectURL(file);
    blobPreviewRef.current = url;
    setCoverPreview(url);
    void uploadCover(file);
  }

  const currentCover = coverPreview ?? playlist.coverUrl;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Настройки плейлиста"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-secondary"
      >
        <Icon name="more-horizontal" size={15} />
        Настройки
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 sm:right-auto sm:left-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="p-3 space-y-3">
              {/* Название */}
              <div className="space-y-1">
                <label htmlFor="playlist-title" className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Название</label>
                <div className="flex items-center gap-1">
                  <input
                    id="playlist-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void saveTitle(); }}
                    className="flex-1 text-sm bg-secondary/50 border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    onClick={() => void saveTitle()}
                    disabled={!title.trim() || title === playlist.title}
                    className="text-xs font-medium px-2 py-1.5 rounded-md hover:bg-secondary disabled:opacity-30 transition-colors"
                  >
                    <Icon name="check" size={14} />
                  </button>
                </div>
              </div>

              {/* Описание */}
              <div className="space-y-1">
                <label htmlFor="playlist-description" className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Описание</label>
                <textarea
                  id="playlist-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                  onBlur={() => void saveDescription()}
                  rows={2}
                  placeholder="Необязательно…"
                  className="w-full text-sm bg-secondary/50 border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-ring resize-none placeholder:text-muted-foreground"
                />
                <p className="text-right text-[10px] text-muted-foreground/50">{description.length}/500</p>
              </div>

              {/* Приватность */}
              <div className="space-y-1">
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Доступ</p>
                <div className="flex gap-1">
                  <button
                    onClick={() => void setVisibility('PRIVATE')}
                    className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md border transition-colors ${visibility === 'PRIVATE' ? 'border-foreground/30 bg-secondary text-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}
                  >
                    <Icon name="lock" size={12} /> Приватный
                  </button>
                  <button
                    onClick={() => void setVisibility('PUBLIC')}
                    className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md border transition-colors ${visibility === 'PUBLIC' ? 'border-foreground/30 bg-secondary text-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}
                  >
                    <Icon name="globe" size={12} /> Публичный
                  </button>
                </div>
              </div>

              {/* Обложка */}
              <div className="space-y-1">
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Обложка</p>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                {currentCover ? (
                  <CoverPreview
                    src={currentCover}
                    onPickFile={() => fileRef.current?.click()}
                    onRemove={() => void removeCover()}
                  />
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-secondary"
                  >
                    <Icon name="upload" size={13} /> Загрузить обложку
                  </button>
                )}
              </div>
            </div>

            {/* Удалить */}
            <div className="border-t border-border px-3 py-2">
              <button
                onClick={() => void handleDelete()}
                className="w-full flex items-center gap-2 text-xs text-destructive/70 hover:text-destructive transition-colors py-1"
              >
                <Icon name="trash" size={13} /> Удалить плейлист
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
