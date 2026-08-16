import { describe, it, expect } from 'vitest';
import { normalizeMediaJob, type ProcessMediaJobData, type TranscodeJobData } from './jobs';

describe('normalizeMediaJob', () => {
  it('новый формат проходит как есть', () => {
    const data: ProcessMediaJobData = { pipeline: 'audio-hls', assetId: 'track-1', sourceKey: 'tracks/track-1/source.flac' };
    expect(normalizeMediaJob(data)).toEqual(data);
  });

  it('старый формат из очереди читается как аудио-конвейер — джобы переживают деплой', () => {
    const legacy: TranscodeJobData = { trackId: 'track-1', sourceKey: 'tracks/track-1/source.flac' };

    expect(normalizeMediaJob(legacy)).toEqual({
      pipeline: 'audio-hls',
      assetId: 'track-1',
      sourceKey: 'tracks/track-1/source.flac',
    });
  });

  it('неизвестный конвейер — null, а не молчаливая обработка аудио-обработчиком', () => {
    expect(normalizeMediaJob({ pipeline: 'video-hls', assetId: 'a', sourceKey: 'k' } as unknown as ProcessMediaJobData)).toBeNull();
  });

  it('джоба без обязательных полей — null в обоих форматах', () => {
    expect(normalizeMediaJob({ pipeline: 'audio-hls', assetId: '', sourceKey: 'k' } as ProcessMediaJobData)).toBeNull();
    expect(normalizeMediaJob({ pipeline: 'audio-hls', assetId: 'a', sourceKey: '' } as ProcessMediaJobData)).toBeNull();
    expect(normalizeMediaJob({ trackId: '', sourceKey: 'k' } as TranscodeJobData)).toBeNull();
    expect(normalizeMediaJob({ trackId: 't' } as TranscodeJobData)).toBeNull();
  });
});
