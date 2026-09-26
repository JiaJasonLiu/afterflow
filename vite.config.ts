import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Two build modes:
//   npm run build          -> installable PWA (service worker precache, offline shell)
//   npm run build:preview  -> one self-contained HTML file, open anywhere
export default defineConfig(({ mode }) => {
  const preview = mode === 'preview'
  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(preview
        ? [viteSingleFile()]
        : [
            VitePWA({
              registerType: 'autoUpdate',
              injectRegister: 'auto',
              includeAssets: ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
              manifest: {
                name: 'Afterglow',
                short_name: 'Afterglow',
                description: 'Track what you watch. Remember how it felt.',
                theme_color: '#0F0D13',
                background_color: '#0F0D13',
                display: 'standalone',
                orientation: 'portrait',
                icons: [
                  { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                  { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
                  { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                ],
              },
              workbox: {
                globPatterns: ['**/*.{js,css,html,woff2,png}'],
                runtimeCaching: [
                  {
                    // TMDB posters/backdrops: cache-first, they never change per URL
                    urlPattern: /^https:\/\/image\.tmdb\.org\/.*/,
                    handler: 'CacheFirst',
                    options: {
                      cacheName: 'tmdb-images',
                      expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 90 },
                    },
                  },
                ],
              },
            }),
          ]),
    ],
    build: preview
      ? { outDir: 'dist-preview', assetsInlineLimit: 100_000_000, cssCodeSplit: false }
      : undefined,
  }
})
