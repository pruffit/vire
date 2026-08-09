'use client';

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { toast } from '@/lib/toast';
import { Textarea } from '@/components/ui-kit';

export interface ClientPost {
  id: string;
  title: string | null;
  body: string;
  createdAt: string;
}

const BODY_MAX = 2000;
const TITLE_MAX = 120;

export function PostsManager({
  initialPosts,
  artistSlug,
}: {
  initialPosts: ClientPost[];
  artistSlug: string;
}) {
  const [posts, setPosts] = useState<ClientPost[]>(initialPosts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const t = useTranslations('dashboard.posts');

  async function create(title: string | null, body: string) {
    const res = await fetch('/api/v1/dashboard/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body }),
    }).catch(() => null);
    if (!res?.ok) {
      toast.error(t('publishFailed'));
      return false;
    }
    const { post } = (await res.json()) as { post: ClientPost & { createdAt: string } };
    setPosts((prev) => [post, ...prev]);
    return true;
  }

  async function save(id: string, title: string | null, body: string) {
    const prev = posts;
    setPosts((p) => p.map((x) => (x.id === id ? { ...x, title, body } : x)));
    setEditingId(null);
    const res = await fetch(`/api/v1/dashboard/posts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body }),
    }).catch(() => null);
    if (!res?.ok) {
      setPosts(prev);
      toast.error(t('saveFailed'));
    }
  }

  async function remove(id: string) {
    const prev = posts;
    setPosts((p) => p.filter((x) => x.id !== id));
    const res = await fetch(`/api/v1/dashboard/posts/${id}`, { method: 'DELETE' }).catch(() => null);
    if (!res?.ok) {
      setPosts(prev);
      toast.error(t('deleteFailed'));
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <Composer onSubmit={create} />

      {posts.length === 0 ? (
        <p className="text-sm text-foreground/40">
          {t('emptyBefore')}{' '}
          <a
            href={`/artists/${artistSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground/70"
          >
            @{artistSlug}
          </a>
          .
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {posts.map((post) => (
              <motion.div
                key={post.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={spring.snappy}
              >
                {editingId === post.id ? (
                  <Composer
                    initialTitle={post.title ?? ''}
                    initialBody={post.body}
                    submitLabel={t('save')}
                    onCancel={() => setEditingId(null)}
                    onSubmit={async (t, b) => {
                      await save(post.id, t, b);
                      return true;
                    }}
                  />
                ) : (
                  <PostCard
                    post={post}
                    onEdit={() => setEditingId(post.id)}
                    onDelete={() => remove(post.id)}
                  />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function Composer({
  initialTitle = '',
  initialBody = '',
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialTitle?: string;
  initialBody?: string;
  submitLabel?: string;
  onSubmit: (title: string | null, body: string) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const t = useTranslations('dashboard.posts');
  const tCommon = useTranslations('dashboard.common');
  const resolvedSubmitLabel = submitLabel ?? t('publish');
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [busy, setBusy] = useState(false);

  const trimmed = body.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= BODY_MAX && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    const ok = await onSubmit(title.trim() || null, trimmed);
    setBusy(false);
    if (ok && !onCancel) {
      setTitle('');
      setBody('');
    }
  }

  return (
    <div className="rounded-xl bg-foreground/[0.025] border border-foreground/10 p-4 flex flex-col gap-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
        placeholder={t('titlePlaceholder')}
        className="bg-transparent text-sm font-medium placeholder:text-foreground/30 focus:outline-none"
      />
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX + 1))}
        placeholder={t('bodyPlaceholder')}
        rows={3}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
        }}
        className="bg-transparent text-sm leading-relaxed placeholder:text-foreground/30 focus:outline-none resize-y min-h-[72px]"
      />
      <div className="flex items-center justify-between gap-3">
        <span
          className={`text-xs font-mono tabular-nums ${
            trimmed.length > BODY_MAX ? 'text-red-400' : 'text-foreground/25'
          }`}
        >
          {trimmed.length}/{BODY_MAX}
        </span>
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-sm px-3 py-1.5 rounded-md text-foreground/50 hover:text-foreground/80 transition-colors pointer-coarse:min-h-11 pointer-coarse:inline-flex pointer-coarse:items-center"
            >
              {tCommon('cancel')}
            </button>
          )}
          <motion.button
            onClick={submit}
            disabled={!canSubmit}
            whileTap={canSubmit ? { scale: 0.96 } : undefined}
            transition={spring.snappy}
            className="text-sm px-4 py-1.5 rounded-md bg-foreground/10 hover:bg-foreground/15 disabled:opacity-30 disabled:hover:bg-foreground/10 transition-colors pointer-coarse:min-h-11 pointer-coarse:inline-flex pointer-coarse:items-center"
          >
            {busy ? '…' : resolvedSubmitLabel}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

function PostCard({
  post,
  onEdit,
  onDelete,
}: {
  post: ClientPost;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const format = useFormatter();
  const t = useTranslations('dashboard.posts');

  return (
    <div className="rounded-xl bg-foreground/[0.025] border border-foreground/10 p-4 flex flex-col gap-2 group">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {post.title && <p className="font-medium leading-snug">{post.title}</p>}
          <p className="text-[11px] font-mono text-foreground/30 mt-0.5">{relativeDate(post.createdAt, format, t)}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="text-xs px-2 py-1 rounded text-foreground/50 hover:text-foreground/90 hover:bg-foreground/5 transition-colors pointer-coarse:min-h-11 pointer-coarse:inline-flex pointer-coarse:items-center"
          >
            {t('edit')}
          </button>
          {confirming ? (
            <button
              onClick={onDelete}
              className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-500/10 transition-colors pointer-coarse:min-h-11 pointer-coarse:inline-flex pointer-coarse:items-center"
            >
              {t('confirmDelete')}
            </button>
          ) : (
            <button
              onClick={() => {
                setConfirming(true);
                setTimeout(() => setConfirming(false), 2500);
              }}
              className="text-xs px-2 py-1 rounded text-foreground/50 hover:text-red-400 hover:bg-foreground/5 transition-colors pointer-coarse:min-h-11 pointer-coarse:inline-flex pointer-coarse:items-center"
            >
              {t('delete')}
            </button>
          )}
        </div>
      </div>
      <p className="text-sm leading-relaxed text-foreground/75 whitespace-pre-line">{post.body}</p>
    </div>
  );
}

function relativeDate(iso: string, format: ReturnType<typeof useFormatter>, t: ReturnType<typeof useTranslations>): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diffMs = Date.now() - then;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return t('justNow');
  if (min < 60) return t('minutesAgo', { count: min });
  const hours = Math.floor(min / 60);
  if (hours < 24) return t('hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return t('yesterday');
  if (days < 7) return t('daysAgo', { count: days });
  return format.dateTime(new Date(iso), { day: 'numeric', month: 'long', year: 'numeric' });
}
