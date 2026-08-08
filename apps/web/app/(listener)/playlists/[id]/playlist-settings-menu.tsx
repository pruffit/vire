'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import type { PlaylistCollaborator } from '@vire/core';
import { toast } from '@/lib/toast';
import { Icon } from '@/components/icon';
import { ChatAvatar } from '@/components/chat/chat-avatar';
import { touchTargetClass } from '@/components/popover';
import { useViewportClampX } from '@/lib/use-viewport-clamp-x';

interface PlaylistMeta {
  id: string;
  title: string;
  description: string | null;
  visibility: 'PRIVATE' | 'PUBLIC';
  coverUrl: string | null;
  isCollaborative: boolean;
}

interface Props {
  playlist: PlaylistMeta;
  collaborators: PlaylistCollaborator[];
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

export function PlaylistSettingsMenu({ playlist, collaborators: initialCollaborators }: Props) {
  const { id, visibility } = playlist;
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(playlist.title);
  const [description, setDescription] = useState(playlist.description ?? '');
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isCollaborative, setIsCollaborative] = useState(playlist.isCollaborative);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState(initialCollaborators);
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const blobPreviewRef = useRef<string | null>(null);
  const router = useRouter();
  const { panelRef, offsetX } = useViewportClampX(open);

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

  async function toggleCollaboration() {
    const next = !isCollaborative;
    setIsCollaborative(next);
    if (!next) setInviteUrl(null);
    const res = await fetch(`/api/v1/playlists/${id}/collaboration`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: next }),
    }).catch(() => null);
    if (!res?.ok) { setIsCollaborative(!next); toast.error('Не удалось изменить совместность'); return; }
    const data = (await res.json()) as { inviteUrl: string | null };
    setInviteUrl(data.inviteUrl);
    router.refresh();
  }

  async function copyInviteLink() {
    let url = inviteUrl;
    if (!url) {
      const res = await fetch(`/api/v1/playlists/${id}/collaboration`).catch(() => null);
      const data = res?.ok ? ((await res.json()) as { inviteUrl: string | null }) : null;
      if (!data?.inviteUrl) { toast.error('Не удалось получить ссылку'); return; }
      url = data.inviteUrl;
      setInviteUrl(url);
    }
    await navigator.clipboard.writeText(url).catch(() => {});
    toast('Ссылка скопирована');
  }

  async function resetInviteLink() {
    const res = await fetch(`/api/v1/playlists/${id}/collaboration`, { method: 'POST' }).catch(() => null);
    if (!res?.ok) { toast.error('Не удалось сбросить ссылку'); return; }
    const data = (await res.json()) as { inviteUrl: string };
    setInviteUrl(data.inviteUrl);
    await navigator.clipboard.writeText(data.inviteUrl).catch(() => {});
    toast('Ссылка обновлена и скопирована');
  }

  function kick(userId: string) {
    const prev = collaborators;
    setCollaborators(prev.filter((c) => c.userId !== userId));
    fetch(`/api/v1/playlists/${id}/collaborators/${userId}`, { method: 'DELETE' })
      .then((r) => { if (!r.ok) { setCollaborators(prev); toast.error('Не удалось исключить участника'); } })
      .catch(() => { setCollaborators(prev); toast.error('Не удалось исключить участника'); });
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
            ref={panelRef}
            initial={{ opacity: 0, y: -6, scale: 0.96, x: offsetX }}
            animate={{ opacity: 1, y: 0, scale: 1, x: offsetX }}
            exit={{ opacity: 0, y: -4, scale: 0.97, x: offsetX }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 sm:right-auto sm:left-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="p-3 space-y-3">
              {/* Название */}
              <div className="space-y-1">
                <label htmlFor="playlist-title" className="label-mono text-[10px] text-muted-foreground">Название</label>
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
                <label htmlFor="playlist-description" className="label-mono text-[10px] text-muted-foreground">Описание</label>
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
                <p className="label-mono text-[10px] text-muted-foreground">Доступ</p>
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
                <p className="label-mono text-[10px] text-muted-foreground">Обложка</p>
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
              {/* Совместность */}
              <div className="space-y-2 border-t border-border pt-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={isCollaborative}
                  onClick={() => void toggleCollaboration()}
                  className="flex min-h-11 w-full items-center justify-between"
                >
                  <span className="label-mono text-[10px] text-muted-foreground">Совместный плейлист</span>
                  <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${isCollaborative ? 'bg-primary' : 'bg-secondary'}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform ${isCollaborative ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </span>
                </button>

                {isCollaborative && (
                  <div className="space-y-2">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => void copyInviteLink()}
                        className="flex-1 flex items-center justify-center gap-1.5 min-h-11 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md transition-colors"
                      >
                        <Icon name="link" size={12} /> Скопировать ссылку
                      </button>
                      <button
                        onClick={() => void resetInviteLink()}
                        className="flex-1 flex items-center justify-center gap-1.5 min-h-11 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md transition-colors"
                      >
                        <Icon name="refresh-cw" size={12} /> Сбросить
                      </button>
                    </div>

                    {collaborators.length > 0 && (
                      <div className="max-h-40 space-y-0.5 overflow-y-auto">
                        {collaborators.map((c) => (
                          <div key={c.userId} className="flex items-center gap-2 px-1 py-1">
                            <ChatAvatar name={c.name} image={c.image} size={22} />
                            <span className="flex-1 min-w-0 truncate text-xs text-foreground/80">{c.name ?? 'Слушатель'}</span>
                            <button
                              onClick={() => kick(c.userId)}
                              aria-label={`Исключить ${c.name ?? 'участника'}`}
                              className={`${touchTargetClass('sm')} rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors`}
                            >
                              <Icon name="user-x" size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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
