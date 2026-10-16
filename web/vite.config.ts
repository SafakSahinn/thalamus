/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages'te site https://<kullanıcı>.github.io/<repo>/ altında yayınlanır.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Zihin Atlası',
        short_name: 'Zihin Atlası',
        description: 'Notlar, kitaplar, makaleler ve sözlük; birbirine bağlı tek bir bilgi haritası.',
        lang: 'tr',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        background_color: '#f7f6f3',
        theme_color: '#f7f6f3',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 6_000_000,
        navigateFallbackDenylist: [/^\/auth/],
      },
    }),
  ],
  test: { environment: 'jsdom' },
});
