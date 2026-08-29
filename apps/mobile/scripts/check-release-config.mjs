#!/usr/bin/env node
/**
 * Барьер перед релизной сборкой мобилки.
 *
 * Каждая проверка здесь стоит за реальным способом выпустить нерабочий APK — эти способы
 * уже сработали и описаны в docs/product/MOBILE_PRODUCT_READINESS_AUDIT.md §14:
 * localhost в бандле (release блокирует cleartext), подпись debug-ключом,
 * google-services.json от чужого пакета (FCM молча не выдаёт токен).
 *
 * Гоняется вручную и из скрипта сборки. Падает с внятным текстом, а не собирает молча.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => JSON.parse(readFileSync(resolve(root, relative), 'utf8'));

const problems = [];
const notes = [];

const { expo } = read('app.json');
const android = expo.android ?? {};
const extra = expo.extra ?? {};

// 1. Идентификатор
if (!android.package) {
  problems.push('app.json: android.package не задан');
} else if (android.package.startsWith('com.anonymous.')) {
  problems.push(
    `app.json: android.package = ${android.package} — плейсхолдер Expo. ` +
      'После публикации в сторе идентификатор не меняется никогда.',
  );
}

// 2. Версия
if (!expo.version) problems.push('app.json: expo.version не задан');
if (!Number.isInteger(android.versionCode) || android.versionCode < 1) {
  problems.push('app.json: android.versionCode должен быть целым ≥ 1 — иначе сборку не обновить поверх прошлой');
}

// 3. Базовые URL. Здесь и жил главный блокер: release-манифест разрешает cleartext
//    только в debug, поэтому http:// в проде = приложение без единого успешного запроса.
for (const key of ['apiBaseUrl', 'webBaseUrl']) {
  const value = extra[key];
  if (!value) {
    problems.push(`app.json: extra.${key} не задан — release-сборке неоткуда взять адрес бэкенда`);
    continue;
  }
  if (!value.startsWith('https://')) {
    problems.push(`app.json: extra.${key} = ${value} — в release допустим только https://`);
  }
  if (/localhost|127\.0\.0\.1|192\.168\.|10\.0\./.test(value)) {
    problems.push(`app.json: extra.${key} = ${value} — локальный адрес в прод-конфигурации`);
  }
}

// 4. google-services.json обязан совпадать с пакетом, иначе Gradle-плагин Google валит
//    сборку («No matching client found»), а при обходе — FCM не выдаёт пуш-токен.
if (android.googleServicesFile) {
  const path = resolve(root, android.googleServicesFile);
  if (!existsSync(path)) {
    problems.push(`google-services.json не найден по пути ${android.googleServicesFile}`);
  } else {
    const gs = JSON.parse(readFileSync(path, 'utf8'));
    const packages = (gs.client ?? []).map((c) => c.client_info?.android_client_info?.package_name);
    if (!packages.includes(android.package)) {
      problems.push(
        `google-services.json не содержит клиента для ${android.package} (есть: ${packages.join(', ') || '—'}). ` +
          'Зарегистрируй приложение с этим пакетом в консоли Firebase и скачай новый файл.',
      );
    }
  }
}

// 5. Подпись. Ключ и пароли в git не лежат — проверяем, что они поданы сборке.
const storeFile = process.env.ORG_GRADLE_PROJECT_VIRE_UPLOAD_STORE_FILE
  ? resolve(root, 'android/app', process.env.ORG_GRADLE_PROJECT_VIRE_UPLOAD_STORE_FILE)
  : resolve(root, 'vire-upload-keystore.jks');
if (!existsSync(storeFile)) {
  problems.push(`Keystore не найден: ${storeFile}. Без него release подпишется чем угодно, только не upload-ключом.`);
}
if (!process.env.ORG_GRADLE_PROJECT_VIRE_UPLOAD_STORE_PASSWORD) {
  problems.push('ORG_GRADLE_PROJECT_VIRE_UPLOAD_STORE_PASSWORD не задан — Gradle подпишет release пустым паролем и упадёт');
}
if (!process.env.ORG_GRADLE_PROJECT_VIRE_UPLOAD_KEY_PASSWORD) {
  problems.push('ORG_GRADLE_PROJECT_VIRE_UPLOAD_KEY_PASSWORD не задан');
}

// 6. Крашрепортинг — предупреждение, не блокер: репозиторий обязан собираться до того,
//    как заведут проект в Sentry.
if (!extra.sentryDsn) {
  notes.push('extra.sentryDsn пуст — падения у тестировщиков собираться НЕ будут (см. docs/features/mobile-app.md)');
}

for (const note of notes) console.warn(`  ! ${note}`);

if (problems.length > 0) {
  console.error('\nРелизная конфигурация мобилки не готова:\n');
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  console.error('');
  process.exit(1);
}

console.log(`✓ Релизная конфигурация в порядке: ${android.package} v${expo.version} (${android.versionCode})`);
