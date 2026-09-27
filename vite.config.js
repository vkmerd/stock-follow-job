import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/ticimax': {
        target: 'https://silverpolo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ticimax/, '/TicimaxXmlV2/280133B373364E089E0235C6FF49A2D2/')
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
