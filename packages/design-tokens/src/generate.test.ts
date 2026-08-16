import { describe, it, expect } from 'vitest';
import { generateCss, generateTs, type Tokens } from './generate';
import tokensJson from './tokens.json';

const tokens = tokensJson as Tokens;

// Независимая от generate.ts таблица имён — сверяет фактические CSS-переменные
// с именами из сегодняшнего packages/ui/src/globals.css (нулевой диф в браузере).
const EXPECTED_CSS_VARS: Record<keyof Tokens['color'], string> = {
  background: 'background',
  foreground: 'foreground',
  card: 'card',
  cardForeground: 'card-foreground',
  popover: 'popover',
  popoverForeground: 'popover-foreground',
  primary: 'primary',
  primaryForeground: 'primary-foreground',
  secondary: 'secondary',
  secondaryForeground: 'secondary-foreground',
  muted: 'muted',
  mutedForeground: 'muted-foreground',
  accent: 'accent',
  accentForeground: 'accent-foreground',
  destructive: 'destructive',
  border: 'border',
  input: 'input',
  ring: 'ring',
};

function parseCssColor(css: string, varName: string): { l: number; c: number; h: number } {
  const re = new RegExp(`--${varName}:\\s*oklch\\(([-\\d.]+)\\s+([-\\d.]+)\\s+([-\\d.]+)\\)`);
  const m = css.match(re);
  if (!m) throw new Error(`--${varName} not found in generated css`);
  return { l: Number(m[1]), c: Number(m[2]), h: Number(m[3]) };
}

function parseCssRadiusPx(css: string): number {
  const m = css.match(/--radius:\s*([\d.]+)rem/);
  if (!m) throw new Error('--radius not found in generated css');
  return Number(m[1]) * 16;
}

function parseTsNumber(ts: string, pattern: RegExp): number {
  const m = ts.match(pattern);
  if (!m) throw new Error(`pattern ${pattern} not found in generated ts`);
  return Number(m[1]);
}

describe('generateCss round-trip', () => {
  const css = generateCss(tokens);

  it('содержит все 18 цветовых переменных под именами из globals.css', () => {
    for (const key of Object.keys(EXPECTED_CSS_VARS) as (keyof Tokens['color'])[]) {
      const parsed = parseCssColor(css, EXPECTED_CSS_VARS[key]);
      expect(parsed).toEqual(tokens.color[key]);
    }
  });

  it('радиус в rem конвертируется обратно в исходное значение px', () => {
    expect(parseCssRadiusPx(css)).toBe(tokens.radius);
  });
});

describe('generateTs round-trip', () => {
  const ts = generateTs(tokens);

  it('содержит все 18 цветовых значений', () => {
    for (const key of Object.keys(tokens.color) as (keyof Tokens['color'])[]) {
      const block = new RegExp(`${key}:\\s*\\{\\s*l:\\s*([-\\d.]+),\\s*c:\\s*([-\\d.]+),\\s*h:\\s*([-\\d.]+)\\s*\\}`);
      const m = ts.match(block);
      expect(m).not.toBeNull();
      expect({ l: Number(m![1]), c: Number(m![2]), h: Number(m![3]) }).toEqual(tokens.color[key]);
    }
  });

  it('sm/md/lg/xl воспроизводят формулу base-2/base/base+4/base+8 из tokens.json', () => {
    expect(parseTsNumber(ts, /sm:\s*(-?\d+)/)).toBe(tokens.radius - 2);
    expect(parseTsNumber(ts, /md:\s*(-?\d+)/)).toBe(tokens.radius);
    expect(parseTsNumber(ts, /lg:\s*(-?\d+)/)).toBe(tokens.radius + 4);
    expect(parseTsNumber(ts, /xl:\s*(-?\d+)/)).toBe(tokens.radius + 8);
  });
});
