import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  // Served as a GitHub Pages project site at deep21star.github.io/nutrios/,
  // not the domain root — every asset/manifest path needs this prefix or
  // the built JS/CSS 404s in production.
  base: '/nutrios/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'NUTRIOS',
        short_name: 'NUTRIOS',
        description: 'Snap a photo. NUTRIOS reads your meal and fills the ring instantly.',
        theme_color: '#0A0A0F',
        background_color: '#0A0A0F',
        display: 'standalone',
        start_url: '/nutrios/',
        scope: '/nutrios/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Meal photos/API responses are handled by our own IndexedDB offline
        // queue (lib/offlineQueue.ts), not the service worker cache — this
        // only precaches the app shell so it launches offline.
        globPatterns: ['**/*.{js,css,html,svg}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
} as any)
