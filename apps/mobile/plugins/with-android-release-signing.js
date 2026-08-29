const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

/**
 * Подпись release и набор ABI, пережившие `expo prebuild`.
 *
 * Папка `android/` намеренно вне git (генерируется), поэтому ручная правка `build.gradle`
 * исчезает при следующей регенерации — до P0 release так и оставался подписан
 * debug-ключом. Плагин — единственный способ держать это решение в репозитории.
 *
 * Учётные данные в git НЕ попадают: keystore лежит рядом (`*.jks` в .gitignore), пароли
 * приходят свойствами Gradle. Gradle сам мапит `ORG_GRADLE_PROJECT_VIRE_UPLOAD_*` из
 * окружения в одноимённые свойства проекта — та же команда работает и локально, и в CI.
 */

// `armeabi-v7a` детерминированно валит CMake/ninja на сборочной машине (пять одинаковых
// падений, docs/features/mobile-app.md «Сборка релизного APK»), а 32-битных ARM-устройств
// в целевом парке нет. `x86_64` нужен эмулятору.
const ARCHITECTURES = 'arm64-v8a,x86_64';

const SIGNING_CONFIG = `        release {
            storeFile file(project.findProperty('VIRE_UPLOAD_STORE_FILE') ?: '../../vire-upload-keystore.jks')
            storePassword project.findProperty('VIRE_UPLOAD_STORE_PASSWORD') ?: ''
            keyAlias project.findProperty('VIRE_UPLOAD_KEY_ALIAS') ?: 'vire-upload'
            keyPassword project.findProperty('VIRE_UPLOAD_KEY_PASSWORD') ?: ''
        }`;

function addReleaseSigningConfig(contents) {
  if (contents.includes('VIRE_UPLOAD_STORE_FILE')) return contents;

  const anchor = /(signingConfigs\s*\{\n)/;
  if (!anchor.test(contents)) {
    throw new Error('with-android-release-signing: не найден блок signingConfigs в app/build.gradle');
  }
  return contents.replace(anchor, `$1${SIGNING_CONFIG}\n\n`);
}

function useReleaseSigningConfig(contents) {
  // Шаблон Expo подписывает release debug-ключом и сопровождает это комментарием
  // «Caution! In production, you need to generate your own keystore file» — после подмены
  // он становится неверным, поэтому убирается вместе с ней. Ищем строго внутри
  // buildTypes.release, а не первое вхождение в файле.
  const pattern =
    /(buildTypes\s*\{[\s\S]*?release\s*\{\s*)(?:\/\/[^\n]*\n\s*)*signingConfig\s+signingConfigs\.debug/;
  if (!pattern.test(contents)) {
    if (/buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.release/.test(contents)) {
      return contents;
    }
    throw new Error('with-android-release-signing: не найден signingConfig в buildTypes.release');
  }
  return contents.replace(pattern, '$1// Подпись upload-ключом — plugins/with-android-release-signing.js\n            signingConfig signingConfigs.release');
}

function setProperty(properties, key, value) {
  const existing = properties.find((item) => item.type === 'property' && item.key === key);
  if (existing) {
    existing.value = value;
    return properties;
  }
  return [...properties, { type: 'property', key, value }];
}

module.exports = function withAndroidReleaseSigning(config) {
  config = withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('with-android-release-signing: ожидался groovy build.gradle');
    }
    cfg.modResults.contents = useReleaseSigningConfig(addReleaseSigningConfig(cfg.modResults.contents));
    return cfg;
  });

  config = withGradleProperties(config, (cfg) => {
    cfg.modResults = setProperty(cfg.modResults, 'reactNativeArchitectures', ARCHITECTURES);
    return cfg;
  });

  return config;
};
