import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const TOOL = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../scripts/measure-reference.mjs'),
  'utf8',
);

/**
 * Сверка платформ обязана мерить ТО, ЧТО ПОКАЗЫВАЮТ СТЕНДЫ, а не собственную пересборку сцены
 * внутри замера. Пересборка уже разошлась со стендом вчетверо: стенд ведёт полярность надписи
 * автоматикой, как продукт, а замер брал материал как есть — на «ступенях» выходило +11 против
 * −70, и таблица сверки была про две разные картинки.
 *
 * Поэтому у обеих платформ путь один: снимок и разбор снимка. Свой рендерер в инструменте — уже
 * ошибка, и её ловит этот тест, а не следующий разбор через неделю.
 */
describe('инструмент сверки', () => {
  it('не рисует сцену сам — только снимает стенд и разбирает снимок', () => {
    expect(TOOL).not.toContain('createVireGlassRenderer');
    expect(TOOL).not.toContain('drawReferenceScene');
  });

  it('веб-половина ходит на стенд /rnd', () => {
    expect(TOOL).toContain('/rnd/');
    expect(TOOL).toContain('page.screenshot');
  });

  // Обе половины обязаны сходиться в одной функции: разошлись окна — разошлись и числа.
  it('обе половины считают профиль одной функцией', () => {
    expect(TOOL.match(/function profile\(/g)).toHaveLength(1);
    expect(TOOL.match(/function locateStrip\(/g)).toHaveLength(1);
  });

  // Путей замера по стенду два — силуэт и тень, — и оба обязаны отказывать на периодическом
  // полотне. Проверка на одном из них ничего не гарантирует про второй.
  it('оба пути по стенду отказываются мерить периодическое полотно', () => {
    expect(TOOL.match(/function skipIfPeriodic\(/g)).toHaveLength(1);
    expect(TOOL.match(/skipIfPeriodic\('/g)).toHaveLength(2);
  });
});
