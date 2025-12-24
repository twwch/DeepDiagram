import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// Tailwind v4 is handled via postcss plugin in this project.

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
