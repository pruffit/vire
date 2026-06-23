'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { actionAdminUpdatePost, actionAdminDeletePost } from '../actions';
import { fieldClass } from '@/components/admin/ui';
import { Textarea } from '@/components/ui-kit';

interface Post {
  id: string;
  title: string | null;
  body: string;
  artistName: string;
  artistSlug: string;
  createdAt: string | Date;
}

const inputCls = `w-full ${fieldClass}`;

export function PostAdminRow({ post }: { post: Post }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(post.title ?? '');
  const [body, setBody] = useState(post.body);
  const [msg, setMsg] = useState<string | null>(null);

  function save() {
    setMsg(null);
    start(async () => {
      const res = await actionAdminUpdatePost(post.id, { title: title || null, body });
      if (res.error) setMsg(res.error);
      else { setOpen(false); router.refresh(); }
    });
  }

  function del() {
    if (!window.confirm('Удалить пост?')) return;
    start(async () => {
      await actionAdminDeletePost(post.id);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a href={`/artists/${post.artistSlug}`} target="_blank" className="text-xs font-mono text-foreground/40 hover:text-foreground transition-colors">
            @{post.artistSlug}
          </a>
          {post.title && <div className="font-medium mt-0.5">{post.title}</div>}
          {!open && <p className="text-sm text-foreground/60 mt-1 line-clamp-2 whitespace-pre-wrap">{post.body}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-foreground/30 font-mono">{new Date(post.createdAt).toLocaleDateString('ru-RU')}</span>
          <button onClick={() => setOpen((s) => !s)} className="rounded-md border border-foreground/10 bg-foreground/5 px-2 py-1 text-xs font-mono transition-colors hover:bg-foreground/10 hover:border-foreground/20 active:scale-[0.98]">
            {open ? 'Свернуть' : 'Изм.'}
          </button>
          <button onClick={del} disabled={pending} className="rounded-md bg-red-500/10 border border-red-500/20 text-red-300 px-2 py-1 text-xs font-mono transition-colors hover:bg-red-500/20 disabled:opacity-40 active:scale-[0.98]">
            Удалить
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-2">
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Заголовок (необязательно)" maxLength={200} />
          <Textarea className={`${inputCls} min-h-24`} value={body} onChange={(e) => setBody(e.target.value)} maxLength={10000} />
          <div className="flex items-center gap-3">
            <button onClick={save} disabled={pending} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40">
              {pending ? 'Сохраняю…' : 'Сохранить'}
            </button>
            {msg && <span className="text-xs text-red-400">{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
