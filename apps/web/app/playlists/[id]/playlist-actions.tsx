'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';

interface Props {
  playlistId: string;
  title: string;
  visibility: 'PRIVATE' | 'PUBLIC';
}

export function PlaylistActions({ playlistId, title, visibility }: Props) {
  const [editing, setEditing] = useState(false);
  const [newTitle, setNewTitle] = useState(title);
  const [currentVisibility, setCurrentVisibility] = useState(visibility);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSaveTitle() {
    if (!newTitle.trim() || newTitle === title) { setEditing(false); return; }
    startTransition(async () => {
      await fetch(`/api/v1/playlists/${playlistId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      setEditing(false);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm('Удалить плейлист?')) return;
    startTransition(async () => {
      await fetch(`/api/v1/playlists/${playlistId}`, { method: 'DELETE' });
      router.push('/profile');
    });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {editing ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setEditing(false); }}
            className="text-xs bg-card border border-border rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={handleSaveTitle}
            disabled={isPending}
            className="text-xs font-medium px-2 py-1 rounded hover:bg-secondary disabled:opacity-40 transition-colors"
          >
            Сохранить
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Переименовать
        </button>
      )}
      <span className="text-muted-foreground opacity-30">·</span>
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
      >
        Удалить
      </button>
    </div>
  );
}
