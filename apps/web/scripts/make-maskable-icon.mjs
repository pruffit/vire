#!/usr/bin/env node
// Разовая генерация public/icon-maskable-512.png из icon-512.png: логотип уменьшен
// в safe-zone (~20% полей), фон #141414 — Android иначе обрежет лого в маске-круге.
import sharp from 'sharp';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const SIZE = 512;
const PADDING = Math.round(SIZE * 0.2);
const INNER = SIZE - PADDING * 2;

const src = join(PUBLIC_DIR, 'icon-512.png');
const out = join(PUBLIC_DIR, 'icon-maskable-512.png');

const logo = await sharp(src).resize(INNER, INNER, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();

await sharp({
  create: {
    width: SIZE,
    height: SIZE,
    channels: 4,
    background: '#141414',
  },
})
  .composite([{ input: logo, left: PADDING, top: PADDING }])
  .png()
  .toFile(out);

console.log(`✓ ${out}`);
