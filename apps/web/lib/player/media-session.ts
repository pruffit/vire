import { usePlayerStore, type PlayerTrack } from '@/store/player';
import { controls } from '@/lib/player/audio-engine';

function metadataFor(track: PlayerTrack): MediaMetadata {
  return new MediaMetadata({
    title: track.title,
    artist: track.artistName,
    artwork: track.coverUrl ? [{ src: track.coverUrl, sizes: '512x512', type: 'image/jpeg' }] : [],
  });
}

function syncMediaSession(track: PlayerTrack | null, isPlaying: boolean): void {
  navigator.mediaSession.metadata = track ? metadataFor(track) : null;
  navigator.mediaSession.playbackState = !track ? 'none' : isPlaying ? 'playing' : 'paused';
}

let initialized = false;

/** Windows SMTC/macOS Control Center/хардварные медиа-клавиши через navigator.mediaSession — обычный веб-API, не Tauri-специфика. */
export function initMediaSession(): void {
  if (initialized || !('mediaSession' in navigator)) return;
  initialized = true;

  navigator.mediaSession.setActionHandler('play', () => controls.togglePlay());
  navigator.mediaSession.setActionHandler('pause', () => controls.togglePlay());
  navigator.mediaSession.setActionHandler('previoustrack', () => controls.prev());
  navigator.mediaSession.setActionHandler('nexttrack', () => void controls.next());

  const { track, isPlaying } = usePlayerStore.getState();
  syncMediaSession(track, isPlaying);

  usePlayerStore.subscribe((state, prevState) => {
    if (state.track !== prevState.track || state.isPlaying !== prevState.isPlaying) {
      syncMediaSession(state.track, state.isPlaying);
    }
  });
}
