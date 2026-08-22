import { describe, it, expect } from 'vitest';
import { resolveReleaseHeader } from '../release-header';
import type { ReleaseDetailResponse } from '@vire/api-contracts';

const release: ReleaseDetailResponse['release'] = {
  id: 'release-1',
  artistProfileId: 'artist-1',
  title: 'Из ответа API',
  type: 'ALBUM',
  genre: null,
  coverUrl: 'https://cdn.viremusic.ru/cover-from-api.jpg',
  releaseDate: '2026-01-01',
  status: 'PUBLISHED',
  description: null,
  linerNotes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('resolveReleaseHeader', () => {
  it('params присутствуют — используются как есть (обычный тап по карточке)', () => {
    const result = resolveReleaseHeader(
      { releaseId: 'release-1', title: 'Из params', artistName: 'Артист', coverUrl: 'https://cdn.viremusic.ru/cover.jpg' },
      null
    );
    expect(result).toEqual({
      title: 'Из params',
      artistName: 'Артист',
      coverUrl: 'https://cdn.viremusic.ru/cover.jpg',
    });
  });

  it('params присутствуют даже если релиз уже загружен — params остаются приоритетом', () => {
    const result = resolveReleaseHeader(
      { releaseId: 'release-1', title: 'Из params', artistName: 'Артист', coverUrl: 'https://cdn.viremusic.ru/cover.jpg' },
      release
    );
    expect(result.title).toBe('Из params');
  });

  it('params отсутствуют, релиз загружен — используются данные релиза, artistName пуст', () => {
    const result = resolveReleaseHeader({ releaseId: 'release-1' }, release);
    expect(result).toEqual({
      title: 'Из ответа API',
      artistName: '',
      coverUrl: 'https://cdn.viremusic.ru/cover-from-api.jpg',
    });
  });

  it('params отсутствуют, релиз ещё не загружен — безопасные дефолты без падения', () => {
    const result = resolveReleaseHeader({ releaseId: 'release-1' }, null);
    expect(result).toEqual({ title: '', artistName: '', coverUrl: null });
  });

  it('частичные params (только releaseId + title) — недостающее берётся из релиза/дефолта', () => {
    const result = resolveReleaseHeader({ releaseId: 'release-1', title: 'Заголовок из диплинка' }, release);
    expect(result).toEqual({ title: 'Заголовок из диплинка', artistName: '', coverUrl: null });
  });
});
