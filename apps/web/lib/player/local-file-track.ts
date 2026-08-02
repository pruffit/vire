import type { PlayerTrack } from '@/store/player';
import { registerLocalFile } from '@/lib/local-files';

export function titleFromFileName(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

/** Регистрирует файл в реестре и заворачивает его как позицию очереди плеера (drag&drop дверь). */
export function fileToPlayerTrack(file: File): PlayerTrack {
  const id = registerLocalFile(file);
  return { id, title: titleFromFileName(file.name), artistName: '', coverUrl: null, localFileId: id };
}

