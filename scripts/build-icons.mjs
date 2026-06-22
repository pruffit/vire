#!/usr/bin/env node
// Сборщик иконок Vire. Источник правды — папка `icons/` в корне репо.
//
//   icons/system/*.svg     → монохромный спрайт (currentColor), <use href="#vire-name">
//   icons/social/*.svg     → бренд-логотипы соцсетей (цветные, как есть)
//   icons/streaming/*.svg  → бренд-логотипы стримингов/магазинов
//
// На выходе:
//   apps/web/public/icons/system-sprite.svg            — спрайт системных иконок
//   apps/web/public/icons/brands/<name>.svg            — чистые бренд-SVG (по файлу на логотип)
//   apps/web/components/icon-manifest.generated.ts     — списки имён (один источник правды)
//
// Бренд-логотипы НЕ кладём в общий спрайт намеренно: у них свои градиенты/классы
// (`.st0`, `SVGID_*`, `clip0_*`), которые в одном документе конфликтуют между собой.
// Отдельные файлы + <img> в <BrandIcon> — без коллизий и без потери цвета.
//
// Запуск: node scripts/build-icons.mjs   (без зависимостей)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'icons');
const PUBLIC_ICONS = path.join(root, 'apps/web/public/icons');
const COMPONENTS = path.join(root, 'apps/web/components');

const svgNames = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith('.svg')).map((f) => f.replace(/\.svg$/, '')).sort()
    : [];

const rootSvgTag = (svg) => {
  const m = svg.match(/<svg\b[^>]*>/i);
  if (!m) throw new Error('no <svg> root');
  return { tag: m[0], start: m.index, end: m.index + m[0].length };
};

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return m ? m[1] : null;
};

// --- системный спрайт: каждый svg → <symbol id="vire-<name>"> -------------------
function buildSystemSprite(names) {
  const symbols = names.map((name) => {
    const svg = fs.readFileSync(path.join(SRC, 'system', `${name}.svg`), 'utf8');
    const { tag, end } = rootSvgTag(svg);
    const inner = svg.slice(end).replace(/<\/svg>\s*$/i, '').trim();
    const viewBox = attr(tag, 'viewBox') ?? '0 0 24 24';
    const fill = attr(tag, 'fill');
    const fillAttr = fill ? ` fill="${fill}"` : '';
    return `<symbol id="vire-${name}" viewBox="${viewBox}"${fillAttr}>${inner}</symbol>`;
  });
  const out = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">${symbols.join('')}</svg>\n`;
  fs.writeFileSync(path.join(PUBLIC_ICONS, 'system-sprite.svg'), out);
  return names.length;
}

// --- бренд-логотипы: чистим и копируем по файлу ---------------------------------
const KEEP_ROOT_ATTRS = ['xmlns', 'xmlns:xlink', 'viewBox', 'fill', 'preserveAspectRatio'];

function cleanBrand(svg) {
  let s = svg
    .replace(/^﻿/, '')
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<desc>[\s\S]*?<\/desc>/gi, '')
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, '')
    .replace(/<sodipodi:namedview[\s\S]*?<\/sodipodi:namedview>/gi, '')
    .replace(/<sodipodi:namedview[^>]*\/>/gi, '')
    // убрать все атрибуты с Inkscape/Sodipodi-префиксами (inkscape:foo="bar", sodipodi:baz="qux")
    .replace(/\s+(?:inkscape|sodipodi|dc|cc|rdf):[a-z-]+=(?:"[^"]*"|'[^']*')/gi, '')
    .trim();

  const { tag, end } = rootSvgTag(s);
  let viewBox = attr(tag, 'viewBox');
  if (!viewBox) {
    const w = attr(tag, 'width');
    const h = attr(tag, 'height');
    if (w && h) viewBox = `0 0 ${parseFloat(w)} ${parseFloat(h)}`;
  }
  const kept = KEEP_ROOT_ATTRS.map((a) => {
    if (a === 'viewBox') return viewBox ? `viewBox="${viewBox}"` : '';
    if (a === 'xmlns') return 'xmlns="http://www.w3.org/2000/svg"';
    const v = attr(tag, a);
    return v ? `${a}="${v}"` : '';
  }).filter(Boolean);

  return `<svg ${kept.join(' ')}>${s.slice(end)}`.replace(/\s+$/, '') + '\n';
}

function buildBrands(group, names, ratios, outSub = 'brands') {
  const outDir = path.join(PUBLIC_ICONS, outSub);
  fs.mkdirSync(outDir, { recursive: true });
  for (const name of names) {
    const svg = fs.readFileSync(path.join(SRC, group, `${name}.svg`), 'utf8');
    const cleaned = cleanBrand(svg);
    fs.writeFileSync(path.join(outDir, `${name}.svg`), cleaned);
    // соотношение сторон (ширина/высота) — чтобы знать вордмарк это или глиф
    const vb = attr(rootSvgTag(cleaned).tag, 'viewBox');
    const parts = vb ? vb.trim().split(/[\s,]+/).map(Number) : null;
    ratios[name] = parts && parts[3] ? Math.round((parts[2] / parts[3]) * 1000) / 1000 : 1;
  }
}

// --- манифест имён --------------------------------------------------------------
function writeManifest(system, social, streaming, glyph, ratios) {
  const arr = (names) => names.map((n) => `  '${n}',`).join('\n');
  const ratioLines = [...social, ...streaming].map((n) => `  '${n}': ${ratios[n]},`).join('\n');
  const out = `// АВТО-СГЕНЕРИРОВАНО: node scripts/build-icons.mjs — не править руками.
// Источник: папка icons/{system,social,streaming,brand-glyph}/*.svg

export const SYSTEM_ICON_NAMES = [
${arr(system)}
] as const;

export const SOCIAL_ICON_NAMES = [
${arr(social)}
] as const;

// Компактные квадратные глифы брендов (для мелких строк редактора). Источник:
// icons/brand-glyph/*.svg. Вордмарки (icons/{social,streaming}) — отдельно, их
// используют лендинги смартлинков.
export const BRAND_GLYPH_NAMES = [
${arr(glyph)}
] as const;

export const STREAMING_ICON_NAMES = [
${arr(streaming)}
] as const;

/** Соотношение сторон бренд-лого (ширина/высота). >2.2 — вордмарк (с текстом). */
export const BRAND_RATIO: Record<string, number> = {
${ratioLines}
};
`;
  fs.writeFileSync(path.join(COMPONENTS, 'icon-manifest.generated.ts'), out);
}

const system = svgNames(path.join(SRC, 'system'));
const social = svgNames(path.join(SRC, 'social'));
const streaming = svgNames(path.join(SRC, 'streaming'));
const glyph = svgNames(path.join(SRC, 'brand-glyph'));

fs.mkdirSync(PUBLIC_ICONS, { recursive: true });
const symCount = buildSystemSprite(system);
const ratios = {};
buildBrands('social', social, ratios);
buildBrands('streaming', streaming, ratios);
buildBrands('brand-glyph', glyph, {}, 'brands-glyph');
writeManifest(system, social, streaming, glyph, ratios);

console.log(`✓ system-sprite.svg: ${symCount} symbols`);
console.log(`✓ brands: ${social.length} social + ${streaming.length} streaming → public/icons/brands/`);
console.log(`✓ brand-glyph: ${glyph.length} → public/icons/brands-glyph/`);
console.log(`✓ icon-manifest.generated.ts`);
