import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// Read version from package.json at build time so it is inlined as a string
// constant — no runtime fs access, works in the browser.
const { version } = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string };

export default defineConfig({
  define: {
    // Inlined at build time — use as __APP_VERSION__ in source code.
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        // Keep SW disabled in dev — it intercepts navigation responses and strips
        // the COOP/COEP headers that PowerSync needs for SharedArrayBuffer/WASM.
        // Without those headers, PowerSync fails to initialise and retries in a tight
        // loop that saturates the JS thread and crashes the tab.
        enabled: false,
      },
      includeAssets: [
        'favicon.ico',
        'favicon.svg',
        'favicon-32x32.png',
        'favicon-16x16.png',
        'apple-touch-icon.png',
      ],
      manifest: {
        name: 'LittleFlower',
        short_name: 'LittleFlower',
        description: 'Family finance tracker',
        theme_color: '#F9F5F7',
        background_color: '#F9F5F7',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Include WASM files so PowerSync SQLite works offline
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm}'],
        // The font packages ship Cyrillic/Vietnamese subsets the UI never renders; skip precaching them
        globIgnores: ['**/*-cyrillic-*.woff2', '**/*-vietnamese-*.woff2'],
        // PowerSync WASM files exceed the default 2 MiB limit — raise to 5 MiB
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // SPA: serve index.html for all navigation requests (offline support)
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.powersync\.journeyapps\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'powersync-api',
              networkTimeoutSeconds: 10,
            },
          },
          {
            // Cache Supabase auth/API calls with network-first strategy
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
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
