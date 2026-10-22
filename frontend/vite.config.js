import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// Dev API target — override (BR_API_TARGET) to run a second backend, e.g. from a worktree.
const API = process.env.BR_API_TARGET || 'http://127.0.0.1:8000'

// /app (no slash) → /app/ so the atelier's relative URLs and #hash routes resolve.
const appTrailingSlash = {
  name: 'app-trailing-slash',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === '/app' || req.url.startsWith('/app?')) {
        res.statusCode = 301
        res.setHeader('Location', req.url.replace('/app', '/app/'))
        res.end()
        return
      }
      next()
    })
  },
}

export default defineConfig({
  plugins: [react(), appTrailingSlash],
  build: {
    rollupOptions: {
      // / = landing page, /app/ = the atelier, /confidentialite.html = privacy.
      input: {
        home: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app/index.html'),
        privacy: resolve(__dirname, 'confidentialite.html'),
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: API,
        changeOrigin: true,
        ws: true,  // proxy WebSocket upgrades (/api/jobs/{id}/ws)
      },
      '/uploads': {
        target: API,
        changeOrigin: true,
      },
      '/segments': {
        target: API,
        changeOrigin: true,
      },
      '/exports': {
        target: API,
        changeOrigin: true,
      },
      '/thumbnails': {
        target: API,
        changeOrigin: true,
      },
      '/memes': {
        target: API,
        changeOrigin: true,
      },
      '/takes': {
        target: API,
        changeOrigin: true,
      },
    },
  },
})
