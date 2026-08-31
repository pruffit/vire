#!/usr/bin/env node
/**
 * Дев-цикл мобилки: правка → секунда до устройства, без пересборки APK.
 *
 * Существует потому, что релизная сборка занимает ~25 минут, а материал, шейдеры и весь
 * стенд — это JavaScript (шейдеры у нас строки в TypeScript). Пересобирать APK ради
 * изменения числа бессмысленно: debug-сборка приложения грузит бандл из Metro.
 *
 *   pnpm --filter @vire/mobile dev            — приложение
 *   pnpm --filter @vire/mobile dev --lab      — стенд материала
 *
 * Полная сборка нужна только когда трогали Kotlin, нативные модули или патчи, и когда
 * нужен релизный артефакт. Debug честно показывает ВИД стекла, но не годится для замеров
 * кадров — для них собирать релиз.
 */
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';
// Флаг и через аргумент, и через окружение: pnpm умеет съесть `--lab` сам, не доведя до
// скрипта, и тогда стенд молча не откроется.
const lab = process.argv.includes('--lab') || process.env.EXPO_PUBLIC_GLASS_LAB === 'material';
const PORT = 8081;

function adbPath() {
  const home = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  const exe = isWindows ? 'adb.exe' : 'adb';
  if (home) {
    const candidate = join(home, 'platform-tools', exe);
    if (existsSync(candidate)) return candidate;
  }
  return exe;
}

// Без reverse устройство не видит Metro и падает в «Unable to load script» — причём
// сообщение винит отсутствующий бандл, а не порт, поэтому диагностируется долго.
const adb = adbPath();
const devices = spawnSync(adb, ['devices'], { encoding: 'utf8' })
  .stdout?.split('\n')
  .slice(1)
  .map((line) => line.split('\t'))
  .filter(([, state]) => state?.trim() === 'device')
  .map(([serial]) => serial.trim()) ?? [];

if (devices.length === 0) {
  console.error('Нет подключённых устройств: подключи телефон или запусти эмулятор.');
  process.exit(1);
}

for (const serial of devices) {
  spawnSync(adb, ['-s', serial, 'reverse', `tcp:${PORT}`, `tcp:${PORT}`], { stdio: 'inherit' });
  console.log(`  reverse ${PORT} → ${serial}`);
}

// `.env` держит localhost:3000 для локального бэкенда. На устройстве это никуда не ведёт,
// и все запросы к API молча ложатся — поэтому по умолчанию целимся в прод, как релиз.
// Переопределить: EXPO_PUBLIC_API_BASE_URL=... pnpm ... dev
const { expo } = JSON.parse(readFileSync(resolve(root, 'app.json'), 'utf8'));

const env = { ...process.env };
env.EXPO_PUBLIC_API_BASE_URL ??= expo?.extra?.apiBaseUrl ?? 'https://viremusic.ru';
env.EXPO_PUBLIC_WEB_BASE_URL ??= expo?.extra?.webBaseUrl ?? 'https://viremusic.ru';
if (lab) env.EXPO_PUBLIC_GLASS_LAB = 'material';

console.log(`  API ${env.EXPO_PUBLIC_API_BASE_URL}${lab ? '  ·  стенд материала' : ''}`);

spawn('npx', ['expo', 'start', '--port', String(PORT)], {
  cwd: root,
  stdio: 'inherit',
  shell: isWindows,
  env,
}).on('exit', (code) => process.exit(code ?? 0));
