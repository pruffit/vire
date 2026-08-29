const { withProjectBuildGradle } = require('expo/config-plugins');

/**
 * Переносит каталог нативной сборки (`.cxx`) из pnpm-стора в `apps/mobile/.cxx`.
 *
 * По умолчанию AGP кладёт `.cxx` рядом с исходниками модуля, то есть внутрь
 * `node_modules/.pnpm/_<хеш>/node_modules/<пакет>/android/`. Для этого репозитория это
 * даёт два независимых повода для отказа, и оба наблюдались:
 *
 * 1. **Длина пути.** Замер: 252 символа до объектного файла при лимите Windows в 260
 *    (`…/@shopify/react-native-skia/android/.cxx/RelWithDebInfo/<hash>/arm64-v8a/prefab/…`).
 * 2. **Симлинки pnpm.** Стор состоит из симлинков; CMake и ninja по-разному нормализуют
 *    такие пути, и правило регенерации `build.ninja` перестаёт сходиться —
 *    `ninja: error: manifest 'build.ninja' still dirty after 100 tries`.
 *
 * Прежний диагноз «виноват armeabi-v7a» (docs/features/mobile-app.md) был корреляцией:
 * триплет `arm-linux-androideabi` длиннее `aarch64-linux-android`, поэтому этот ABI
 * упирался в лимит первым. После добавления зависимости то же падение воспроизвелось на
 * `arm64-v8a`, а полная очистка всех `.cxx` его не сняла — то есть дело не в ABI и не в
 * устаревшем кеше.
 *
 * `apps/mobile/.cxx/<модуль>` — короткий путь без симлинков; снимает обе причины сразу.
 */
const SUBPROJECT_BLOCK = `
// Каталог нативной сборки — вне pnpm-стора: plugins/with-native-build-dir.js
subprojects { subproject ->
    subproject.plugins.withId("com.android.library") {
        subproject.extensions.findByName("android")?.with {
            externalNativeBuild {
                cmake {
                    buildStagingDirectory = new File(rootProject.projectDir, "../.cxx/\${subproject.name}")
                }
            }
        }
    }
}
`;

module.exports = function withNativeBuildDir(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('with-native-build-dir: ожидался groovy build.gradle');
    }
    if (cfg.modResults.contents.includes('with-native-build-dir')) return cfg;
    cfg.modResults.contents += SUBPROJECT_BLOCK;
    return cfg;
  });
};
