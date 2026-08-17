// Монорепо: workspace-пакеты (@vire/*) физически лежат вне apps/mobile — Metro должен
// видеть корень репозитория и резолвить их через pnpm-симлинки в node_modules.
// https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// pnpm резолвит транзитивные зависимости (expo-modules-core и т.п.) через вложенные
// node_modules внутри .pnpm-хранилища — hierarchical lookup обязателен, отключать нельзя
// (в отличие от типового Yarn/npm-хоардинга, под который написан гайд Expo для монорепо).
config.watchFolders = [workspaceRoot];
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
