/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // Dev-only proxy so the SPA can call the BFF same-origin (no CORS, no hard-coded host).
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
        headers: process.env.VITE_DEV_API_KEY ? { 'X-API-Key': process.env.VITE_DEV_API_KEY } : {},
      },
    },
  },
  test: {
    environment: 'jsdom',
    // jsdom has no origin, so fetch needs an absolute base URL; msw handlers use the same constant.
    env: { VITE_API_BASE_URL: 'http://localhost:8000/api/v1', VITE_API_RETRY_BASE_MS: '0' },
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/main.tsx'],
    },
  },
})
