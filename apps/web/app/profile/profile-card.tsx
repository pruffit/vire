'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import Image from 'next/image';
import { signOut } from 'next-auth/react';
import { motion, AnimatePresence } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { Icon } from '@/components/icon';

interface Stats {
  likes: number;
  following: number;
  playlists: number;
}

interface Props {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    createdAt: Date | null;
  };
  stats: Stats;
}

const MONTHS_RU = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

function formatJoined(date: Date): string {
  return `с ${MONTHS_RU[date.getMonth()]} ${date.getFullYear()}`;
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

export function ProfileCard({ user, stats }: Props) {
  const displayName = user.name ?? user.email?.split('@')[0] ?? 'Слушатель';
  const initials = displayName.slice(0, 2).toUpperCase();

  const [name, setName] = useState(displayName);
  const [image, setImage] = useState(user.image);
  const [imgError, setImgError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayName);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // позволяем выбрать тот же файл повторно
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setAvatarError('Файл больше 5 МБ'); return; }

    setUploading(true);
    setAvatarError(null);
    const fd = new FormData();
    fd.append('avatar', file);
    const res = await fetch('/api/v1/user/profile', { method: 'POST', body: fd });
    setUploading(false);
    if (res.ok) {
      const data = await res.json();
      setImage(data.image);
      setImgError(false);
    } else {
      const data = await res.json().catch(() => null);
      setAvatarError(data?.error ?? 'Не удалось загрузить фото');
    }
  }

  async function handleAvatarRemove() {
    setUploading(true);
    setAvatarError(null);
    const fd = new FormData();
    fd.append('removeAvatar', '1');
    const res = await fetch('/api/v1/user/profile', { method: 'POST', body: fd });
    setUploading(false);
    if (res.ok) { setImage(null); setImgError(false); }
    else setAvatarError('Не удалось удалить фото');
  }

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function startEdit() {
    setDraft(name);
    setEditing(true);
    setSaved(false);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft(name);
  }

  function handleSave() {
    if (!draft.trim() || draft.trim() === name) { setEditing(false); return; }
    startTransition(async () => {
      const res = await fetch('/api/v1/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: draft.trim() }),
      });
      if (res.ok) {
        setName(draft.trim());
        setSaved(true);
        setEditing(false);
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* Avatar + identity */}
      <div className="flex items-start gap-5">
        {/* Avatar */}
        <div className="shrink-0 flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label="Изменить фото"
            className="group relative w-[72px] h-[72px] rounded-full overflow-hidden ring-2 ring-border ring-offset-2 ring-offset-background cursor-pointer disabled:cursor-wait"
          >
            {image && !imgError ? (
              <Image
                src={image}
                alt={name}
                width={72}
                height={72}
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full bg-secondary flex items-center justify-center text-xl font-semibold text-muted-foreground">
                {initials}
              </div>
            )}
            {/* Оверлей */}
            <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity">
              {uploading ? (
                <span className="text-[10px] font-medium text-white">…</span>
              ) : (
                <CameraIcon />
              )}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
          {image && !uploading && (
            <button
              type="button"
              onClick={handleAvatarRemove}
              className="text-[10px] text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
            >
              Удалить
            </button>
          )}
          {avatarError && <p className="text-[10px] text-red-400 text-center max-w-[80px] leading-tight">{avatarError}</p>}
        </div>

        {/* Name + email + date */}
        <div className="flex-1 min-w-0 pt-1 space-y-0.5">
          <div className="flex items-center gap-2 min-w-0">
            <AnimatePresence mode="wait" initial={false}>
              {editing ? (
                <motion.div
                  key="input"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={spring.snappy}
                  className="flex items-center gap-2 flex-1 min-w-0"
                >
                  <input
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSave();
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    maxLength={50}
                    className="flex-1 min-w-0 bg-transparent border-b border-primary text-xl font-semibold tracking-tight outline-none pb-0.5"
                    aria-label="Отображаемое имя"
                  />
                  <button
                    onClick={handleSave}
                    disabled={isPending || !draft.trim()}
                    className="text-xs font-medium text-primary hover:opacity-70 transition-opacity disabled:opacity-30 shrink-0"
                  >
                    {isPending ? '…' : 'Сохранить'}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    Отмена
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="display"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={spring.snappy}
                  className="flex items-center gap-2 min-w-0 group"
                >
                  <h1 className="text-xl font-semibold tracking-tight truncate">
                    {name}
                  </h1>
                  <button
                    onClick={startEdit}
                    aria-label="Изменить имя"
                    className="opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity"
                  >
                    <PencilIcon />
                  </button>
                  <AnimatePresence>
                    {saved && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={spring.snappy}
                        className="text-xs text-primary font-mono shrink-0"
                      >
                        ✓
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
          {user.createdAt && (
            <p className="text-xs text-muted-foreground/60">{formatJoined(user.createdAt)}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6">
        <StatItem value={stats.likes} label={plural(stats.likes, 'лайк', 'лайка', 'лайков')} />
        <div className="w-px h-6 bg-border" aria-hidden="true" />
        <StatItem value={stats.following} label={plural(stats.following, 'артист', 'артиста', 'артистов')} />
        <div className="w-px h-6 bg-border" aria-hidden="true" />
        <StatItem value={stats.playlists} label={plural(stats.playlists, 'плейлист', 'плейлиста', 'плейлистов')} />
      </div>

      {/* Sign out */}
      <div className="pt-2 border-t border-border">
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="text-sm text-muted-foreground hover:text-destructive transition-colors"
        >
          Выйти из аккаунта →
        </button>
      </div>
    </div>
  );
}

function StatItem({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-2xl font-semibold tabular-nums tracking-tight">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function PencilIcon() {
  return <Icon name="edit-2" size={13} />;
}
