import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:20800',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:20800',
        ws: true,
      },
      '/plugins': {
        target: 'http://localhost:20800',
        changeOrigin: true,
      },
    },
  },
})
