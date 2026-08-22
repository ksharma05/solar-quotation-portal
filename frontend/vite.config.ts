import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split the framework from app code so a deploy does not invalidate the
        // large, rarely-changing vendor chunks in returning users' caches.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) {
            return 'vendor-react'
          }
          if (id.includes('@headlessui') || id.includes('motion') || id.includes('@floating-ui')) {
            return 'vendor-ui'
          }
          if (id.includes('zod') || id.includes('react-hook-form') || id.includes('@hookform')) {
            return 'vendor-forms'
          }
          return undefined
        },
      },
    },
  },
})
