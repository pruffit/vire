#!/usr/bin/env node
// IO-обвязка вокруг чистых генераторов в ../src/generate.ts — сама не форматирует токены.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateCss, generateTs } from '../src/generate.ts';

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const tokens = JSON.parse(readFileSync(join(PKG_ROOT, 'src', 'tokens.json'), 'utf8'));

const distDir = join(PKG_ROOT, 'dist');
mkdirSync(distDir, { recursive: true });
writeFileSync(join(distDir, 'tokens.css'), generateCss(tokens));
writeFileSync(join(distDir, 'tokens.ts'), generateTs(tokens));

console.log('✓ @vire/design-tokens: dist/tokens.css, dist/tokens.ts');
