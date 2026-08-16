import { describe, it, expect } from 'vitest';
import { composeHomeScreen, screenRevision, HOME_SCREEN_VERSION } from './home-screen';

const GUEST = { isAuthenticated: false };
const LISTENER = { isAuthenticated: true };

describe('composeHomeScreen — состав', () => {
  it('гость не получает персональных блоков', () => {
    const types = composeHomeScreen(GUEST).blocks.map((b) => b.type);
    expect(types).not.toContain('personal');
    expect(types).not.toContain('feed');
    expect(types).not.toContain('friends-activity');
    expect(types).not.toContain('discovery');
  });

  it('порядок блоков гостя — тот же, что на статической главной', () => {
    expect(composeHomeScreen(GUEST).blocks.map((b) => b.type)).toEqual([
      'featured-release',
      'flow',
      'hot-tracks',
      'fresh-releases',
      'upcoming',
      'listening-now',
      'playlists',
      'artists',
      'catalog-empty-notice',
    ]);
  });

  it('порядок блоков слушателя — тот же, что на статической главной', () => {
    expect(composeHomeScreen(LISTENER).blocks.map((b) => b.type)).toEqual([
      'featured-release',
      'flow',
      'personal',
      'feed',
      'friends-activity',
      'hot-tracks',
      'fresh-releases',
      'upcoming',
      'listening-now',
      'playlists',
      'artists',
      'discovery',
      'catalog-empty-notice',
    ]);
  });

  it('id блоков уникальны — они и React key, и ключ аналитики', () => {
    const ids = composeHomeScreen(LISTENER).blocks.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('композиция детерминирована при одинаковом входе', () => {
    expect(composeHomeScreen(LISTENER)).toEqual(composeHomeScreen(LISTENER));
  });

  it('внутреннее состояние не утекает наружу: правка результата не влияет на следующий вызов', () => {
    const first = composeHomeScreen(GUEST);
    first.blocks[0].props.injected = true;
    expect(composeHomeScreen(GUEST).blocks[0].props).toEqual({});
  });
});

describe('composeHomeScreen — совместимость клиентов', () => {
  it('клиент получает только те типы, которые умеет рендерить', () => {
    const screen = composeHomeScreen({ isAuthenticated: true, supportedBlocks: ['featured-release', 'hot-tracks'] });
    expect(screen.blocks.map((b) => b.type)).toEqual(['featured-release', 'hot-tracks']);
  });

  it('пустой список поддерживаемых типов = ограничений нет (веб)', () => {
    expect(composeHomeScreen({ isAuthenticated: false, supportedBlocks: [] }).blocks.length).toBeGreaterThan(0);
  });

  it('незнакомый серверу тип в списке клиента ничего не ломает', () => {
    const screen = composeHomeScreen({ isAuthenticated: false, supportedBlocks: ['flow', 'quantum-block'] });
    expect(screen.blocks.map((b) => b.type)).toEqual(['flow']);
  });
});

describe('screenRevision', () => {
  it('одинаковая композиция — одинаковый отпечаток', () => {
    expect(composeHomeScreen(GUEST).revision).toBe(composeHomeScreen(GUEST).revision);
  });

  it('разный состав — разный отпечаток', () => {
    expect(composeHomeScreen(GUEST).revision).not.toBe(composeHomeScreen(LISTENER).revision);
  });

  it('смена версии экрана меняет отпечаток', () => {
    const blocks = composeHomeScreen(GUEST).blocks;
    expect(screenRevision(blocks, HOME_SCREEN_VERSION)).not.toBe(screenRevision(blocks, HOME_SCREEN_VERSION + 1));
  });
});
