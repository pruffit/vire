#!/usr/bin/env node
// Генерирует квадратные ЦВЕТНЫЕ глиф-логотипы стримингов из пакета simple-icons
// (официальный одно-путёвый знак + фирменный цвет) в icons/streaming/<name>.svg.
// Так в мелком боксе ссылки стоит компактный знак, а не «дешёвый» вордмарк.
//
// Соцсети (icons/social) НЕ трогаем — там уже квадратные цветные логотипы.
// Площадки, которых нет в simple-icons (RU/Amazon), рисуются вручную и НЕ
// перетираются этим скриптом (см. список SKIP).
//
// Запуск: node scripts/build-brand-glyphs.mjs && node scripts/build-icons.mjs
import * as si from 'simple-icons';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// brand-файл → точное название в simple-icons, по папкам-источникам.
const STREAMING = {
  spotify: 'Spotify',
  'apple-music': 'Apple Music',
  'youtube-music': 'YouTube Music',
  soundcloud: 'SoundCloud',
  bandcamp: 'Bandcamp',
  deezer: 'Deezer',
  tidal: 'TIDAL',
  'vk-music': 'VK',
};
const SOCIAL = {
  youtube: 'YouTube',
  bandlab: 'BandLab',
  bandsintown: 'Bandsintown',
  bluesky: 'Bluesky',
  discord: 'Discord',
};

const byTitle = {};
for (const k in si) {
  const ic = si[k];
  if (ic && ic.title) byTitle[ic.title.toLowerCase()] = ic;
}

let n = 0;
for (const [group, map] of [['streaming', STREAMING], ['social', SOCIAL]]) {
  const dir = path.join(root, 'icons', group);
  for (const [name, title] of Object.entries(map)) {
    const ic = byTitle[title.toLowerCase()];
    if (!ic) {
      console.warn('MISS', name, '←', title);
      continue;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#${ic.hex}"><path d="${ic.path}"/></svg>\n`;
    fs.writeFileSync(path.join(dir, `${name}.svg`), svg);
    n++;
    console.log('OK  ', `${group}/${name}`.padEnd(22), `#${ic.hex}`);
  }
}
console.log(`\n${n} глифов сгенерировано. Вручную: yandex-music, zvuk, amazon-music, kion-music.`);
