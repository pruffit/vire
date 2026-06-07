// Чистая логика расчёта waveform-пиков из сырого PCM (16-bit LE моно).
// Вынесена из ffmpeg.ts, чтобы тестировать без запуска ffmpeg.

/**
 * Разбивает PCM на `numPeaks` бакетов и берёт пиковую амплитуду в каждом.
 * Возвращает массив из `numPeaks` значений в диапазоне [0, 1], округлённых до 4 знаков.
 */
export function peaksFromPcm(pcm: Buffer, numPeaks = 200): number[] {
  const totalSamples = Math.floor(pcm.length / 2); // 16-bit = 2 байта
  const bucketSize = Math.max(1, Math.floor(totalSamples / numPeaks));
  const peaks: number[] = [];

  for (let i = 0; i < numPeaks; i++) {
    let max = 0;
    const start = i * bucketSize;
    for (let j = 0; j < bucketSize; j++) {
      const byteIdx = (start + j) * 2;
      if (byteIdx + 1 < pcm.length) {
        const sample = Math.abs(pcm.readInt16LE(byteIdx)) / 32768;
        if (sample > max) max = sample;
      }
    }
    peaks.push(Number(max.toFixed(4)));
  }

  return peaks;
}
