import type { PlayerTrack } from '@/store/player';
import { controls } from './audio-engine';
import { toast } from '@/lib/toast';

/** Общий вход для обеих дверей добавления локальных файлов — кнопки и drag&drop. */
export function enqueueLocalTracks(tracks: PlayerTrack[]): void {
  if (tracks.length === 0) return;
  const inserted = controls.enqueue(tracks, 'end', { source: 'direct' });
  toast(`Добавлено в очередь: ${inserted}`);
}
