import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'LittleFlower',
        short_name: 'LittleFlower',
        description: 'Family finance tracker',
        theme_color: '#f9a8d4', // pastel pink
        background_color: '#fdf2f8',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Include WASM files so PowerSync SQLite works offline
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm}'],
        // PowerSync WASM files exceed the default 2 MiB limit — raise to 5 MiB
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.powersync\.journeyapps\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'powersync-api',
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  // ---------------------------------------------------------------------------
  // PowerSync / wa-sqlite WASM support
  //
  // PowerSync uses @journeyapps/wa-sqlite (WASM SQLite) running in a Web Worker.
  // The worker and WASM files are served as static assets. These headers allow
  // the SharedArrayBuffer used by the WASM to work correctly in the browser.
  // ---------------------------------------------------------------------------
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    // Exclude PowerSync from pre-bundling — it uses dynamic WASM imports
    // that Vite's dep optimizer doesn't handle correctly
    exclude: ['@powersync/web'],
  },
  worker: {
    format: 'es',
  },
});
