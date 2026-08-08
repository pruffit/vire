'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { Icon } from '@/components/icon';
import { toast } from '@/lib/toast';

interface Props {
  code: string;
  /** Сколько треков очереди реально уедет в плейлист (только каталог VireMusic). */
  savableCount: number;
  /** Всего элементов в очереди — чтобы отличить «пусто» от «только внешние ссылки». */
  queueLength: number;
}

export function JamSavePlaylist({ code, savableCount, queueLength }: Props) {
  const [saving, setSaving] = useState(false);
  const [savedPlaylistId, setSavedPlaylistId] = useState<string | null>(null);

  async function handleSave() {
    // Тот же отказ, что и у API, но без похода в сеть: клик по заведомо пустой очереди
    // раньше давал 400 и молчаливый провал.
    if (savableCount === 0) {
      toast.error(queueLength > 0
        ? 'В плейлист идут только треки каталога VireMusic'
        : 'Очередь пуста — добавьте треки');
      return;
    }
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
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border border-border px-3 sm:px-4 text-sm text-primary hover:text-foreground transition-colors"
      >
        <Icon name="check" size={14} /> <span className="hidden sm:inline">Открыть плейлист</span>
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
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border border-border px-3 sm:px-4 text-sm transition-colors disabled:opacity-60 cursor-pointer ${
        savableCount === 0 ? 'text-muted-foreground/50' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {saving ? <Icon name="loader" size={14} className="animate-spin" /> : <Icon name="save" size={14} />}
      <span className="hidden sm:inline">Сохранить в плейлист</span>
    </motion.button>
  );
}
