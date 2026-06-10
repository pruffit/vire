/**
 * Загрузчик VK Video Player API (videoplayer.js) + типы.
 * Управляет встроенным video_ext.php-iframe (нужен параметр js_api=1 в src):
 * `VK.VideoPlayer(iframe)` возвращает инстанс с play/pause/seek/громкостью.
 */

export interface VkPlayerInstance {
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  /** Громкость 0..1 */
  setVolume(value: number): void;
  getVolume(): number;
  getCurrentTime(): number;
  getDuration(): number;
  getState(): string; // 'uninited' | 'unstarted' | 'playing' | 'paused' | 'ended' | 'error'
  on(event: string, handler: (state?: unknown) => void): void;
  off(event: string, handler?: (state?: unknown) => void): void;
  destroy(): void;
}

type VkVideoPlayerFactory = (iframe: HTMLIFrameElement) => VkPlayerInstance;

declare global {
  interface Window {
    VK?: { VideoPlayer?: VkVideoPlayerFactory };
  }
}

const SCRIPT_SRC = 'https://vk.com/js/api/videoplayer.js';
let loadPromise: Promise<VkVideoPlayerFactory> | null = null;

export function loadVkPlayerApi(): Promise<VkVideoPlayerFactory> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
  if (window.VK?.VideoPlayer) return Promise.resolve(window.VK.VideoPlayer);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<VkVideoPlayerFactory>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.VK?.VideoPlayer) resolve(window.VK.VideoPlayer);
      else reject(new Error('VK.VideoPlayer не появился после загрузки скрипта'));
    };
    script.onerror = () => {
      loadPromise = null; // позволить повторную попытку
      reject(new Error('Не удалось загрузить videoplayer.js'));
    };
    document.head.appendChild(script);
  });
  return loadPromise;
}
