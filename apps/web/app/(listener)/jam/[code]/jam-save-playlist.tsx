'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { Icon } from '@/components/icon';
import { touchTargetClass } from '@/components/popover';
import { toast } from '@/lib/toast';

interface Props {
  code: string;
}

export function JamSavePlaylist({ code }: Props) {
  const [saving, setSaving] = useState(false);
  const [savedPlaylistId, setSavedPlaylistId] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/jam/${encodeURIComponent(code)}/save-playlist`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? String(res.status));
      setSavedPlaylistId((data as { playlistId: string }).playlistId);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Не удалось сохранить плейлист');
    } finally {
      setSaving(false);
    }
  }

  if (savedPlaylistId) {
    return (
      <Link
        href={`/playlists/${savedPlaylistId}`}
        className={`${touchTargetClass('md')} inline-flex items-center gap-1.5 rounded-full border border-border px-3 text-sm text-primary hover:text-foreground transition-colors`}
      >
        <Icon name="check" size={14} /> Открыть плейлист
      </Link>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={() => void handleSave()}
      disabled={saving}
      aria-label="Сохранить очередь в плейлист"
      whileTap={{ scale: 0.9 }}
      transition={spring.snappy}
      className={`${touchTargetClass('md')} inline-flex items-center gap-1.5 rounded-full border border-border px-3 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60 cursor-pointer`}
    >
      {saving ? <Icon name="loader" size={14} className="animate-spin" /> : <Icon name="save" size={14} />}
      Сохранить в плейлист
    </motion.button>
  );
}
