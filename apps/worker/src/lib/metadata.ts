import { parseFile } from 'music-metadata';

export interface AudioMetadata {
  durationSec: number;
  bpm: number | null;
  musicalKey: string | null;
}

// Читает теги из FLAC-файла (ID3/Vorbis Comment).
// BPM и тональность заполняются только если артист прописал их в метаданных.
export async function readAudioMetadata(filePath: string): Promise<AudioMetadata> {
  const meta = await parseFile(filePath, { duration: true });
  return {
    durationSec: Math.round(meta.format.duration ?? 0),
    bpm: meta.common.bpm ? Math.round(meta.common.bpm) : null,
    musicalKey: meta.common.key ?? null,
  };
}
