import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'child_process';

import { defineConfig } from 'vite';

// Get git commit hash for version tracking
const getGitCommitHash = () => {
  try {
    return execSync('git rev-parse HEAD').toString().trim();
  } catch {
    return 'development';
  }
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
      },
      includeAssets: ['apple-touch-icon.png', 'icon-*.svg', 'social-preview.png'],
      manifest: {
        name: 'Coil',
        short_name: 'Coil',
        description: 'Distraction-free visual timer',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        icons: [
          {
            src: 'icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
          {
            src: 'icon-32.svg',
            sizes: '32x32',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
          {
            src: 'icon-any-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icon-any-32.svg',
            sizes: '32x32',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
    }),
    // Plugin to replace __APP_VERSION__ in HTML
    {
      name: 'html-transform',
      transformIndexHtml(html) {
        return html.replace('__APP_VERSION__', getGitCommitHash());
      },
    },
  ],
  base: process.env.NODE_ENV === 'production' ? '/coil-timer/' : '/',
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  define: {
    __APP_VERSION__: JSON.stringify(getGitCommitHash()),
  },
});
