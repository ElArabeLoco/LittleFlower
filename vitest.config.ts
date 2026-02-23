import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

/**
 * Vitest config is separate from vite.config.ts so that Vite plugins
 * (TanStack Router, PWA) do not run during unit tests.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**'],
      reporter: ['text', 'html'],
    },
  },
});
