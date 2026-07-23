import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // The console (/app) is installable; the service worker is registered only
    // from the app entry so the landing stays untouched by PWA lifecycle.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      // Self-destroying worker: the precache SW kept serving a poisoned copy
      // of the app shell (a corrupt entry bricks the page to a black screen,
      // and since the app JS never runs, the update poll never runs either —
      // a permanent lock until a manual unregister). This ships a cleanup SW
      // that unregisters itself and purges all caches, so every already-
      // poisoned browser self-heals on its next visit and no new precache can
      // brick the page. PWA installability can return post-showcase with a
      // config that never precaches the entry (e.g. NetworkFirst shell).
      selfDestroying: true,
      manifest: {
        name: 'Verglas',
        short_name: 'Verglas',
        description: 'Owner console for rule-bound agent vaults on Avalanche.',
        start_url: '/app/',
        scope: '/',
        display: 'standalone',
        background_color: '#0b0b10',
        theme_color: '#0b0b10',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Everything under dist is real files (docs are merged post-build and
        // stay network-served); no SPA fallback wanted.
        navigateFallback: null,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // A freshly installed worker activates and takes the page over on its
        // own — without these the update sat in "waiting" until a manual
        // unregister (the chronic stale-bundle problem).
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  resolve: {
    // @verglas/sdk is a file: dependency carrying its own node_modules;
    // without dedupe the bundle would ship two viem copies.
    dedupe: ['viem'],
  },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        app: fileURLToPath(new URL('./app/index.html', import.meta.url)),
      },
    },
  },
})
