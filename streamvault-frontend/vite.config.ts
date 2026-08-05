import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/framer-motion')) {
            return 'motion-vendor';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'icons-vendor';
          }
        },
      },
    },
  },
  server: {
    host: true,
    port: 5203,
    strictPort: false,
    proxy: {
      '/tmdb-img': {
        target: 'https://image.tmdb.org/t/p',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tmdb-img/, ''),
        secure: false,
      },
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:7166',
        changeOrigin: true,
        secure: false,
      },
    },
  }
})
