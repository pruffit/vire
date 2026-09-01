#!/usr/bin/env node
/**
 * Сборка подписанного release-APK одной командой, одинаково локально и в CI.
 *
 * Существует ради воспроизводимости: `android/` не в git (генерируется `prebuild`), так что
 * «собери руками в Android Studio» — не инструкция, а способ получить каждый раз разный
 * артефакт. Здесь зафиксированы и порядок шагов, и способ передачи учётных данных.
 *
 * Пароли берутся из окружения (`ORG_GRADLE_PROJECT_*` Gradle подхватывает сам как свойства
 * проекта) — в репозиторий не попадают. Локально удобно так:
 *
 *   ORG_GRADLE_PROJECT_VIRE_UPLOAD_STORE_PASSWORD=$(cat vire-upload-keystore.password.txt) \
 *   ORG_GRADLE_PROJECT_VIRE_UPLOAD_KEY_PASSWORD=$(cat vire-upload-keystore.password.txt) \
 *   pnpm --filter @vire/mobile build:android
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';

// Прод-адрес обязан приходить ТОЛЬКО из app.json, который лежит в git. Локальный `.env`
// (вне git) задаёт EXPO_PUBLIC_API_BASE_URL для разработки, Expo грузит его при любой
// сборке, а в резолвере явный override сильнее app.json — то есть release унёс бы в бандл
// localhost с машины сборщика. Гасим их на время релизной сборки; `expo start` не задет.
const releaseEnv = { ...process.env };
delete releaseEnv.EXPO_PUBLIC_API_BASE_URL;
delete releaseEnv.EXPO_PUBLIC_WEB_BASE_URL;
releaseEnv.EXPO_NO_DOTENV = '1';

// Заливка source maps в Sentry требует организации, проекта и SENTRY_AUTH_TOKEN. Пока
// токена нет — заливать некуда, а gradle-задача `…_SentryUpload_…` валит ВСЮ сборку
// (плюс её `sentry-cli` не резолвится под pnpm: sentry.gradle ищет его через
// require.resolve из android/). Сам крашрепортинг от этого не страдает — DSN живёт в
// рантайме, source maps влияют только на читаемость стектрейса в панели.
if (!releaseEnv.SENTRY_AUTH_TOKEN) {
  releaseEnv.SENTRY_DISABLE_AUTO_UPLOAD = 'true';
  releaseEnv.SENTRY_DISABLE_NATIVE_DEBUG_UPLOAD = 'true';
  console.log('  ! SENTRY_AUTH_TOKEN не задан — source maps в Sentry не заливаются (сборка не блокируется)');
}

function run(command, args, cwd) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: isWindows, env: releaseEnv });
  if (result.status !== 0) {
    console.error(`\nШаг упал: ${command} ${args.join(' ')}`);
    process.exit(result.status ?? 1);
  }
}

// prebuild переносит app.json в нативный проект: пакет, версию, google-services и config-плагины
// (подпись + набор ABI — plugins/with-android-release-signing.js). Без него правки app.json
// в APK не попадают вообще.
//
// `--fast` пропускает этот шаг. Смысл: prebuild сносит `android/` целиком, вместе с кэшем
// CMake, поэтому нативный C++ пересобирается даже когда правка чисто JS-овая — а шейдеры
// у нас живут строками в TypeScript, и таких итераций большинство. Пропускать МОЖНО ровно
// пока не менялись app.json, конфиг-плагины, патчи нативных модулей и код в modules/.
// Флаг читается И из аргументов, И из окружения: `pnpm build:android --fast` съедает флаг
// сам, не доводя до скрипта (нужно `pnpm build:android -- --fast`), и молчаливо собирает
// долгим путём. Переменная от этого не зависит.
const androidDir = resolve(root, 'android');
const fast = process.argv.includes('--fast') || process.env.VIRE_FAST_BUILD === '1';

if (fast && existsSync(androidDir)) {
  console.log('  ! --fast: prebuild пропущен, нативная часть берётся из android/ как есть');
} else {
  run('npx', ['expo', 'prebuild', '--platform', 'android'], root);
}

if (!existsSync(androidDir)) {
  console.error('prebuild не создал android/ — дальше идти некуда');
  process.exit(1);
}

// Абсолютный путь: под Windows `shell:true` не резолвит `gradlew.bat` из cwd.
run(resolve(androidDir, isWindows ? 'gradlew.bat' : 'gradlew'), ['assembleRelease', '--no-daemon'], androidDir);

const apk = resolve(androidDir, 'app/build/outputs/apk/release/app-release.apk');
if (!existsSync(apk)) {
  console.error('Gradle отработал, но APK не найден:', apk);
  process.exit(1);
}

console.log(`\n✓ APK собран: ${apk}`);
console.log('  Проверить подпись: apksigner verify --print-certs "<путь к apk>"');
