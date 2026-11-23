/**
 * @packageDocumentation
 * Vite configuration for the Smart Bookshelf web application.
 *
 * Requests to `/api` are proxied to the backend, so the browser always talks to
 * a single origin (no CORS in development). The proxy target is configurable via
 * `VITE_API_PROXY_TARGET` (Docker sets it to `http://backend:3000`).
 */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const apiTarget = env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000'
  // File-system events are not propagated into containers from Windows/macOS bind mounts.
  const usePolling = env.VITE_USE_POLLING === 'true'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      watch: usePolling ? { usePolling: true, interval: 300 } : undefined,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
