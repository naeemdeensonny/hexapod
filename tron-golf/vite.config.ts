import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registration is done by hand in main.tsx: inside the Capacitor WebView a
      // service worker would cache the app in storage that survives installing a
      // new APK, permanently pinning the native app to an old build.
      injectRegister: null,
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
      },
      manifest: {
        name: 'TRON Golf',
        short_name: 'TRON Golf',
        description: 'Golf GPS and scorecard',
        theme_color: '#000820',
        background_color: '#000820',
        display: 'standalone',
        orientation: 'portrait',
        scope: './',
        start_url: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  // Stamped into the menu footer so a stale build is obvious at a glance.
  define: {
    __BUILD_ID__: JSON.stringify(
      new Date().toISOString().slice(5, 16).replace('T', ' '),
    ),
  },
  base: './',
  server: { port: 5173 },
});
