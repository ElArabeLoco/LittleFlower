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
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/routeTree.gen.ts',
        'src/main.tsx',
        'src/**/*.test.{ts,tsx}',
        'src/infrastructure/powersync/schema.ts',
      ],
      reporter: ['text', 'html'],
    },
  },
});
