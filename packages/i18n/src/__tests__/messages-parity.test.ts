import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { NAMESPACES } from '../messages';

const MESSAGES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../messages');

function loadJson(locale: string, namespace: string): unknown {
  return JSON.parse(readFileSync(join(MESSAGES_DIR, locale, `${namespace}.json`), 'utf8'));
}

/** Плоский путь → строковое значение; массивы индексируются, чтобы расхождение
 *  структуры (напр. другое число пунктов legal.json) ловилось как разница ключей. */
function flatten(value: unknown, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof value === 'string') {
    out.set(prefix, value);
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => {
      for (const [k, v] of flatten(item, `${prefix}[${i}]`)) out.set(k, v);
    });
  } else if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${key}` : key;
      for (const [k, vv] of flatten(v, path)) out.set(k, vv);
    }
  } else {
    out.set(prefix, String(value));
  }
  return out;
}

/** Топ-уровневые `{...}`-блоки строки с учётом вложенных фигурных скобок. */
function braceBlocks(text: string): string[] {
  const blocks: string[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue;
    let depth = 1;
    let j = i + 1;
    while (j < text.length && depth > 0) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') depth--;
      j++;
    }
    blocks.push(text.slice(i + 1, j - 1));
    i = j - 1;
  }
  return blocks;
}

/** Имена ICU-аргументов (`{count}`, `{count, plural, ...}`, `{kind, select, ...}`) —
 *  без содержимого веток plural/select, которое может отличаться словами по локали. */
function icuPlaceholders(value: string): string[] {
  const names = new Set<string>();
  for (const block of braceBlocks(value)) {
    const commaIdx = block.indexOf(',');
    if (commaIdx === -1) {
      names.add(block.trim());
      continue;
    }
    names.add(block.slice(0, commaIdx).trim());
    const afterType = block.slice(commaIdx + 1);
    const secondComma = afterType.indexOf(',');
    const branchesPart = secondComma === -1 ? '' : afterType.slice(secondComma + 1);
    for (const branch of braceBlocks(branchesPart)) {
      for (const nested of icuPlaceholders(branch)) names.add(nested);
    }
  }
  return [...names].sort();
}

describe('словарь ru/en — паритет', () => {
  for (const namespace of NAMESPACES) {
    describe(namespace, () => {
      const ru = flatten(loadJson('ru', namespace));
      const en = flatten(loadJson('en', namespace));

      it('одинаковый набор ключей', () => {
        expect([...en.keys()].sort()).toEqual([...ru.keys()].sort());
      });

      it('нет пустых значений', () => {
        for (const [key, value] of ru) expect(value.trim(), `ru.${namespace}.${key}`).not.toBe('');
        for (const [key, value] of en) expect(value.trim(), `en.${namespace}.${key}`).not.toBe('');
      });

      it('совпадают ICU-плейсхолдеры в парных значениях', () => {
        for (const [key, ruValue] of ru) {
          const enValue = en.get(key);
          if (enValue === undefined) continue; // поймано тестом на набор ключей
          expect(icuPlaceholders(enValue), `${namespace}.${key}`).toEqual(icuPlaceholders(ruValue));
        }
      });
    });
  }
});
