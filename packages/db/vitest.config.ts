import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    // Тесты на живой базе делят одну схему — параллельные файлы затирали бы данные друг друга.
    fileParallelism: false,
  },
});
