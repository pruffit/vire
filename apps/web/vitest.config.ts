import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.tsx'],
    include: [
      'lib/**/*.test.ts', 'lib/**/*.test.tsx',
      'app/**/*.test.ts', 'app/**/*.test.tsx',
      'components/**/*.test.ts', 'components/**/*.test.tsx',
      'store/**/*.test.ts', 'store/**/*.test.tsx',
    ],
    // Кейсы с vi.resetModules() переисполняют тяжёлый граф модулей на каждый тест;
    // на Windows под параллельной нагрузкой это не укладывается в дефолтные 5с.
    testTimeout: 20000,
    server: {
      // next-intl's ESM build imports bare `next/navigation` (no extension); `next`
      // has no package.json "exports" map, so Node's native ESM loader can't resolve
      // it when the dep is left external. Inlining routes it through Vite's resolver.
      deps: { inline: [/next-intl/] },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
});
