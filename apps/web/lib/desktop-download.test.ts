import { afterEach, describe, expect, it } from 'vitest';
import { getWindowsDownloadUrl } from './desktop-download';

const ORIGINAL_ENDPOINT = process.env.S3_PUBLIC_ENDPOINT;

afterEach(() => {
  if (ORIGINAL_ENDPOINT === undefined) delete process.env.S3_PUBLIC_ENDPOINT;
  else process.env.S3_PUBLIC_ENDPOINT = ORIGINAL_ENDPOINT;
});

describe('getWindowsDownloadUrl', () => {
  it('строит стабильный URL из S3_PUBLIC_ENDPOINT и стрим-бакета', () => {
    process.env.S3_PUBLIC_ENDPOINT = 'https://cdn.viremusic.ru';
    expect(getWindowsDownloadUrl()).toBe(
      'https://cdn.viremusic.ru/vire-stream/downloads/desktop/windows/VireMusic-Setup-x64.exe',
    );
  });

  it('снимает завершающий слэш из endpoint', () => {
    process.env.S3_PUBLIC_ENDPOINT = 'https://cdn.viremusic.ru/';
    expect(getWindowsDownloadUrl()).toBe(
      'https://cdn.viremusic.ru/vire-stream/downloads/desktop/windows/VireMusic-Setup-x64.exe',
    );
  });

  it('без S3_PUBLIC_ENDPOINT возвращает null', () => {
    delete process.env.S3_PUBLIC_ENDPOINT;
    expect(getWindowsDownloadUrl()).toBeNull();
  });
});
