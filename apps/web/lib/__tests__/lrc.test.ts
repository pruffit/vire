import { describe, it, expect } from 'vitest';
import { parseLrc, serializeLrc, isSynced } from '../lrc';

describe('parseLrc', () => {
  it('парсит синхронизированные строки', () => {
    const r = parseLrc('[00:12.50]Первая\n[00:15.00]Вторая');
    expect(r).toEqual([
      { t: 12.5, text: 'Первая' },
      { t: 15, text: 'Вторая' },
    ]);
  });

  it('сортирует по времени', () => {
    const r = parseLrc('[00:20.00]B\n[00:05.00]A');
    expect(r.map((l) => l.text)).toEqual(['A', 'B']);
  });

  it('повторяющийся таймкод в строке → несколько строк', () => {
    const r = parseLrc('[00:01.00][00:10.00]Припев');
    expect(r).toEqual([
      { t: 1, text: 'Припев' },
      { t: 10, text: 'Припев' },
    ]);
  });

  it('игнорирует метатеги', () => {
    const r = parseLrc('[ar:Артист]\n[ti:Трек]\n[00:01.00]Строка');
    expect(r).toEqual([{ t: 1, text: 'Строка' }]);
  });

  it('простой текст без таймкодов → строки с t=null', () => {
    const r = parseLrc('Первая строка\nВторая строка');
    expect(r).toEqual([
      { t: null, text: 'Первая строка' },
      { t: null, text: 'Вторая строка' },
    ]);
  });

  it('пустой ввод → []', () => {
    expect(parseLrc('')).toEqual([]);
    expect(parseLrc('   \n  ')).toEqual([]);
  });

  it('поддерживает таймкод без долей и с миллисекундами', () => {
    expect(parseLrc('[01:05]Без долей')).toEqual([{ t: 65, text: 'Без долей' }]);
    expect(parseLrc('[00:01.500]Мс')).toEqual([{ t: 1.5, text: 'Мс' }]);
  });
});

describe('serializeLrc / isSynced', () => {
  it('сериализует обратно в LRC', () => {
    expect(serializeLrc([{ t: 12.5, text: 'Привет' }])).toBe('[00:12.50]Привет');
  });

  it('строки без таймкода — просто текст', () => {
    expect(serializeLrc([{ t: null, text: 'Просто' }])).toBe('Просто');
  });

  it('round-trip parse→serialize→parse стабилен', () => {
    const src = '[00:03.20]Раз\n[00:07.00]Два';
    expect(parseLrc(serializeLrc(parseLrc(src)))).toEqual(parseLrc(src));
  });

  it('isSynced', () => {
    expect(isSynced([{ t: 1, text: 'a' }])).toBe(true);
    expect(isSynced([{ t: null, text: 'a' }])).toBe(false);
    expect(isSynced([])).toBe(false);
    expect(isSynced(null)).toBe(false);
  });
});
