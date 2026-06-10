import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/voice': {
        target: 'https://voice.zenxai.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/voice/, '/api'),
      },
      '/api/chat': {
        target: 'https://chat.zenxai.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/chat/, '/api'),
      }
    }
  }
})
