import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
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
