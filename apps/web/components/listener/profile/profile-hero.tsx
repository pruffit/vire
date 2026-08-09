'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
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
  likedMinutes: number;
}

export function ProfileHero({ user, stats, likedMinutes }: Props) {
  const t = useTranslations('profile.profileHero');
  const months = t.raw('months') as string[];

  function formatJoined(date: Date): string {
    return t('joinedSince', { date: `${months[date.getMonth()]} ${date.getFullYear()}` });
  }

  const displayName = user.name ?? user.email?.split('@')[0] ?? t('anonymousListener');
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
    if (file.size > 5 * 1024 * 1024) { setAvatarError(t('avatarTooLarge')); return; }

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
      setAvatarError(data?.error ?? t('avatarUploadFailed'));
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
    else setAvatarError(t('avatarRemoveFailed'));
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

  const runtimeReadout =
    likedMinutes >= 60
      ? t('loveHours', { hours: Math.round(likedMinutes / 60) })
      : likedMinutes > 0
        ? t('loveMinutes', { minutes: likedMinutes })
        : null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-end gap-5 animate-fade-up">
      <div className="shrink-0 flex flex-col items-center gap-1.5">
        <div className="relative w-28 h-28 sm:w-36 sm:h-36">
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-full blur-2xl opacity-25 scale-150"
            style={{ background: 'var(--primary)' }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label={t('changePhoto')}
            className="group relative z-10 w-full h-full rounded-full overflow-hidden ring-1 ring-border cursor-pointer disabled:cursor-wait"
          >
            {image && !imgError ? (
              <Image
                src={image}
                alt={name}
                width={144}
                height={144}
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full bg-secondary flex items-center justify-center text-3xl font-semibold text-muted-foreground">
                {initials}
              </div>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 transition-opacity">
              {uploading ? (
                <span className="text-xs font-medium text-white">…</span>
              ) : (
                <CameraIcon />
              )}
            </span>
          </button>
        </div>
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
            className="text-[11px] text-muted-foreground hover:text-destructive transition-colors cursor-pointer pointer-coarse:min-h-11 pointer-coarse:inline-flex pointer-coarse:items-center"
          >
            {t('removePhoto')}
          </button>
        )}
        {avatarError && <p className="text-[11px] text-red-400 text-center max-w-[120px] leading-tight">{avatarError}</p>}
      </div>

      <div className="flex-1 min-w-0 space-y-2">
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
                  className="flex-1 min-w-0 bg-transparent border-b border-primary text-2xl sm:text-4xl font-bold tracking-tight outline-none pb-0.5"
                  aria-label={t('displayNameAriaLabel')}
                />
                <button
                  onClick={handleSave}
                  disabled={isPending || !draft.trim()}
                  className="text-xs font-medium text-primary hover:opacity-70 transition-opacity disabled:opacity-30 shrink-0 pointer-coarse:min-h-11 pointer-coarse:inline-flex pointer-coarse:items-center"
                >
                  {isPending ? t('saving') : t('save')}
                </button>
                <button
                  onClick={cancelEdit}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 pointer-coarse:min-h-11 pointer-coarse:inline-flex pointer-coarse:items-center"
                >
                  {t('cancel')}
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
                <h1 className="min-w-0 text-2xl sm:text-4xl font-bold tracking-tight truncate">{name}</h1>
                <button
                  onClick={startEdit}
                  aria-label={t('editName')}
                  className="opacity-0 group-hover:opacity-40 hover:!opacity-100 pointer-coarse:opacity-100 pointer-coarse:w-11 pointer-coarse:h-11 pointer-coarse:-m-1.5 pointer-coarse:inline-flex pointer-coarse:items-center pointer-coarse:justify-center transition-opacity"
                >
                  <Icon name="edit-2" size={15} />
                </button>
                <AnimatePresence>
                  {saved && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={spring.snappy}
                      className="inline-flex text-primary shrink-0"
                    >
                      <Icon name="check" size={14} />
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

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <StatChip value={stats.likes} label={t('statLikes', { count: stats.likes })} />
          <StatChip value={stats.following} label={t('statFollowing', { count: stats.following })} />
          <StatChip value={stats.playlists} label={t('statPlaylists', { count: stats.playlists })} />
        </div>

        {runtimeReadout && (
          <p className="font-mono text-xs text-muted-foreground">{runtimeReadout}</p>
        )}
      </div>
    </div>
  );
}

function StatChip({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1 rounded-full bg-secondary/60 px-3 py-1 text-sm">
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function CameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}
