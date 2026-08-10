import { describe, it, expect } from 'vitest';
import { resolveSmartLinkDisplay } from './smart-link-display';
import type { ReleaseStatus } from '../catalog/types/release';

const NOW = new Date('2026-07-10T12:00:00Z');
const PAST = new Date('2026-07-01T00:00:00Z');
const FUTURE = new Date('2026-08-01T00:00:00Z');

const emptyLink = { title: '', coverUrl: null, releaseDate: null };
const filledLink = {
  title: 'Заголовок лендинга',
  coverUrl: 'https://cdn.test/link.jpg',
  releaseDate: PAST,
};

function release(status: ReleaseStatus, releaseDate: Date | null) {
  return { title: 'Название релиза', coverUrl: 'https://cdn.test/release.jpg', releaseDate, status };
}

describe('resolveSmartLinkDisplay', () => {
  it('без привязанного релиза отдаёт поля лендинга', () => {
    expect(resolveSmartLinkDisplay(filledLink, null, NOW)).toEqual({
      title: 'Заголовок лендинга',
      coverUrl: 'https://cdn.test/link.jpg',
      releaseDate: PAST,
      cta: null,
    });
  });

  it('опубликованный релиз дополняет пустые поля и даёт кнопку «слушать»', () => {
    expect(resolveSmartLinkDisplay(emptyLink, release('PUBLISHED', PAST), NOW)).toEqual({
      title: 'Название релиза',
      coverUrl: 'https://cdn.test/release.jpg',
      releaseDate: PAST,
      cta: 'listen',
    });
  });

  it('SCHEDULED с будущей датой — пресейв, данные релиза видны', () => {
    expect(resolveSmartLinkDisplay(emptyLink, release('SCHEDULED', FUTURE), NOW)).toEqual({
      title: 'Название релиза',
      coverUrl: 'https://cdn.test/release.jpg',
      releaseDate: FUTURE,
      cta: 'presave',
    });
  });

  it('SCHEDULED с наступившей датой — «слушать»', () => {
    expect(resolveSmartLinkDisplay(emptyLink, release('SCHEDULED', PAST), NOW).cta).toBe('listen');
  });

  for (const status of ['DRAFT', 'ARCHIVED'] as const) {
    it(`${status} не утекает ни в одно поле и не даёт кнопку`, () => {
      for (const date of [null, PAST, FUTURE]) {
        expect(resolveSmartLinkDisplay(emptyLink, release(status, date), NOW)).toEqual({
          title: '',
          coverUrl: null,
          releaseDate: null,
          cta: null,
        });
      }
    });
  }

  it('SCHEDULED без даты скрыт как черновик', () => {
    expect(resolveSmartLinkDisplay(emptyLink, release('SCHEDULED', null), NOW)).toEqual({
      title: '',
      coverUrl: null,
      releaseDate: null,
      cta: null,
    });
  });

  it('заданные поля лендинга приоритетнее релиза', () => {
    expect(resolveSmartLinkDisplay(filledLink, release('PUBLISHED', FUTURE), NOW)).toEqual({
      title: 'Заголовок лендинга',
      coverUrl: 'https://cdn.test/link.jpg',
      releaseDate: PAST,
      cta: 'listen',
    });
  });
});
