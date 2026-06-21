'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { actionAdminUpdatePlaylist, actionAdminDeletePlaylist } from '../actions';

interface Playlist {
  id: string;
  title: string;
  visibility: 'PRIVATE' | 'PUBLIC';
  kind: string;
  isCurated: boolean;
  ownerEmail: string | null;
  trackCount: number;
  likesCount: number;
  createdAt: string | Date;
}

const inputCls =
  'rounded-md bg-white/5 border border-white/10 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-white/30';

export function PlaylistAdminRow({ playlist }: { playlist: Playlist }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(playlist.title);
  const [visibility, setVisibility] = useState(playlist.visibility);
  const [msg, setMsg] = useState<string | null>(null);

  const dirty = title !== playlist.title || visibility !== playlist.visibility;

  function save() {
    setMsg(null);
    start(async () => {
      const res = await actionAdminUpdatePlaylist(playlist.id, { title, visibility });
      if (res.error) setMsg(res.error);
      else router.refresh();
    });
  }

  function del() {
    if (!window.confirm('Удалить плейлист? Треки в нём тоже отвяжутся.')) return;
    start(async () => {
      await actionAdminDeletePlaylist(playlist.id);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-white/10 p-4 flex flex-wrap items-center gap-3">
      <input className={`${inputCls} flex-1 min-w-48`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
      <select className={inputCls} value={visibility} onChange={(e) => setVisibility(e.target.value as 'PRIVATE' | 'PUBLIC')}>
        <option value="PRIVATE">приватный</option>
        <option value="PUBLIC">публичный</option>
      </select>
      <span className="text-xs font-mono text-white/35 flex gap-2">
        <span title="вид">{playlist.kind}{playlist.isCurated ? '·кур' : ''}</span>
        <span title="треков">{playlist.trackCount}♪</span>
        <span title="лайков">{playlist.likesCount}♥</span>
      </span>
      <span className="text-[11px] text-white/30 font-mono truncate max-w-40" title={playlist.ownerEmail ?? 'система'}>
        {playlist.ownerEmail ?? 'система'}
      </span>
      <div className="flex items-center gap-2 ml-auto">
        {msg && <span className="text-xs text-red-400">{msg}</span>}
        <button onClick={save} disabled={pending || !dirty} className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 disabled:opacity-30">
          {pending ? '…' : 'Сохранить'}
        </button>
        <button onClick={del} disabled={pending} className="rounded-md bg-red-500/10 border border-red-500/20 text-red-400 px-2.5 py-1.5 text-xs font-mono hover:bg-red-500/20 disabled:opacity-40">
          Удалить
        </button>
      </div>
    </div>
  );
}
