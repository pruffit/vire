'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icon';
import { setVisualizerStream } from '@/lib/visualizer/audio-tap';

/**
 * Звук чужого iframe (YouTube/SoundCloud) из кода не прочитать никак. Захват вкладки —
 * единственный способ дать визуализации настоящий сигнал с любого источника. Поток идёт
 * только в анализатор, в динамики не выводится: иначе тот же звук зазвучал бы дважды.
 */
export function VisualizerCaptureButton() {
  const [active, setActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setVisualizerStream(null);
  }, []);

  function stop(): void {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setVisualizerStream(null);
    setActive(false);
  }

  async function start(): Promise<void> {
    try {
      // video обязателен: без него Chrome не предлагает поделиться звуком вкладки.
      const stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
      stream.getVideoTracks().forEach((track) => track.stop());
      const audio = stream.getAudioTracks();
      if (audio.length === 0) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      audio[0]!.addEventListener('ended', stop);
      streamRef.current = stream;
      setVisualizerStream(new MediaStream(audio));
      setActive(true);
    } catch {
      // отказ в диалоге — просто остаёмся на прежнем источнике
    }
  }

  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) return null;

  return (
    <button
      type="button"
      onClick={() => (active ? stop() : void start())}
      aria-pressed={active}
      aria-label={active ? 'Не слышать звук вкладки' : 'Слышать весь звук вкладки'}
      title={active ? 'Визуализация слышит вкладку' : 'Дать визуализации слышать звук вкладки (нужно для YouTube)'}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${
        active ? 'border-white/70 text-white' : 'border-white/15 text-white/50 hover:text-white'
      }`}
    >
      <Icon name={active ? 'volume-2' : 'volume'} size={16} />
    </button>
  );
}
