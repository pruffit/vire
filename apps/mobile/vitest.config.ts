import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // `__DEV__` — глобал RN-рантайма, в node его нет. `lib/env.ts` по нему выбирает между
  // LAN-автоопределением и прод-адресом из app.json; в тестах ведём себя как dev-сборка.
  define: { __DEV__: 'true' },
  test: {
    environment: 'node',
    alias: {
      // см. lib/__mocks__/expo-constants.ts и lib/__mocks__/react-native.ts — оба тянут/
      // являются react-native (Flow-синтаксис), который node-окружение vitest не парсит.
      'expo-constants': path.resolve(process.cwd(), 'lib/__mocks__/expo-constants.ts'),
      'react-native': path.resolve(process.cwd(), 'lib/__mocks__/react-native.ts'),
    },
  },
});
