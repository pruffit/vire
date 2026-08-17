import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    alias: {
      // см. lib/__mocks__/expo-constants.ts — реальный пакет тянет react-native (Flow),
      // который node-окружение vitest распарсить не может.
      'expo-constants': path.resolve(process.cwd(), 'lib/__mocks__/expo-constants.ts'),
    },
  },
});
