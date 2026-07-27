import type HlsType from 'hls.js';
import type { HlsConfig } from 'hls.js';

/** Часть исходников даёт «дыру» у начала буфера — повышенная терпимость и число попыток перепрыгнуть. */
export const HLS_TUNING: Partial<HlsConfig> = { maxBufferHole: 0.5, nudgeOffset: 0.2, nudgeMaxRetry: 8 };

/** Залип на дыре в начале буфера — перепрыгиваем на старт первого буферизованного диапазона. */
export function attachStallRecovery(hls: HlsType, audio: HTMLAudioElement, Hls: typeof HlsType): void {
  hls.on(Hls.Events.ERROR, (_evt, data) => {
    if (data.fatal || data.details !== 'bufferStalledError') return;
    try {
      const buffered = audio.buffered;
      if (buffered.length > 0 && audio.currentTime < buffered.start(0)) {
        audio.currentTime = buffered.start(0) + 0.01;
        audio.play().catch(() => {});
      }
    } catch { /* buffered может бросить, если медиа ещё не готово */ }
  });
}
