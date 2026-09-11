import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'favicon.png',
        'apple-touch-icon.png',
        'pwa-icon-192.png',
        'pwa-icon-512.png',
        'updated_logo_2.jpeg',
      ],
      workbox: {
        globIgnores: ['**/heic2any-*.js'],
      },
      manifest: {
        name: 'Lalitamba FD Gadag',
        short_name: 'Lalitamba FD',
        description: 'Family fixed deposits for Lalitamba, Gadag',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/pwa-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 43187,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 43187,
    strictPort: true,
  },
})
