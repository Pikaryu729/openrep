/// <reference types="vitest/config" />
import path from 'node:path'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routeFileIgnorePattern: '\\.test\\.',
    }),
    react(),
    tailwindcss(),
    VitePWA({
      // `injectManifest` (not `generateSW`): src/sw.ts is ours to extend —
      // the offline-data module adds write-queue/cache-then-network `/api`
      // handling to the same file later. Don't switch strategies.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // Never 'autoUpdate': a silent SW swap-and-reload mid-workout would
      // discard in-progress form state. UpdatePrompt asks first.
      registerType: 'prompt',
      manifest: {
        name: 'OpenRep',
        short_name: 'OpenRep',
        description: 'A local-first strength training tracker.',
        // Light-mode defaults only (src/index.css --accent/--background) —
        // the manifest is static and can't follow the live theme; the
        // <meta name="theme-color"> split in index.html covers live chrome.
        theme_color: '#3f3f46',
        background_color: '#f6f6f7',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // Keeps dev same-origin, matching how the packaged app serves both.
    proxy: {
      '/api': {
        target: process.env.OPENREP_BACKEND_URL ?? 'http://127.0.0.1:8765',
        changeOrigin: false,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
})
