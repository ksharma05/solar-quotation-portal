import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

/**
 * Kept separate from vite.config.ts: vitest 2 ships its own bundled Vite, so sharing
 * one config makes the two Vite plugin types collide. The engine tests are pure TS
 * in a node environment and need no plugins.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
