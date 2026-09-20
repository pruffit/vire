import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const APP_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Делитель живёт в двух файлах: стенд кодирует им индексы в кадр, зонд их оттуда читает.
// Разойдутся — зонд молча прочитает чужую зону (так уже было при 16 против 14 зон).
function stateScale(file: string): number {
  const src = readFileSync(path.join(APP_DIR, file), 'utf8');
  const match = src.match(/STATE_SCALE\s*=\s*(\d+)/);
  if (!match) throw new Error(`STATE_SCALE не найдена в ${file}`);
  return Number(match[1]);
}

describe('делитель состояния стенда', () => {
  it('одинаков у стенда и у зонда', () => {
    expect(stateScale('scripts/glass-probe.mjs')).toBe(stateScale('screens/material-lab.tsx'));
  });
});
