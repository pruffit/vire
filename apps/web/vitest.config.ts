import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'lib/**/*.test.ts', 'lib/**/*.test.tsx',
      'app/**/*.test.ts', 'app/**/*.test.tsx',
      'components/**/*.test.ts', 'components/**/*.test.tsx',
      'store/**/*.test.ts', 'store/**/*.test.tsx',
    ],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
});
