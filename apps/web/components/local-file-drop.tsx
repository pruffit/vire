'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from '@/components/icon';
import { fileToPlayerTrack } from '@/lib/player/local-file-track';
import { enqueueLocalTracks } from '@/lib/player/enqueue-local-files';

const AUDIO_EXTENSIONS = ['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.aac'];

function isAudioFile(file: File): boolean {
  if (file.type.startsWith('audio/')) return true;
  const lower = file.name.toLowerCase();
  return AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function hasFiles(e: DragEvent): boolean {
  return Boolean(e.dataTransfer?.types.includes('Files'));
}

/** Вторая дверь добавления локальных файлов в очередь (первая — кнопка в панели). HTML5 DnD
 *  на window не конфликтует с dnd-kit в очереди (тот работает через pointer events). */
export function LocalFileDrop() {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    // dragenter/dragleave считаем по глубине — leave дочернего элемента не должен гасить оверлей раньше времени.
    let depth = 0;

    function onDragEnter(e: DragEvent) {
      if (!hasFiles(e)) return;
      depth += 1;
      setDragging(true);
    }

    function onDragOver(e: DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
    }

    function onDragLeave(e: DragEvent) {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    }

    function onDrop(e: DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const files = Array.from(e.dataTransfer?.files ?? []).filter(isAudioFile);
      if (files.length === 0) return;
      enqueueLocalTracks(files.map(fileToPlayerTrack));
    }

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  return (
    <AnimatePresence>
      {dragging && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-background/85 backdrop-blur-sm pointer-events-none px-6"
        >
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary/60 px-8 py-8 sm:px-10 text-center">
            <Icon name="file-plus" size={32} className="text-primary" />
            <p className="text-base font-medium">Отпустите — добавим в очередь</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
