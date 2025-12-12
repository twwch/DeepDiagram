import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // Using the v4 plugin if available, but I installed postcss.
// Wait, if it is v4, we use @tailwindcss/vite. If v3, we use postcss.
// I manually created postcss.config.js for v3.
// But if v4 is installed, I should use the plugin?
// Let's stick to standard postcss approach for now which works with v3 and v4 via postcss plugin usually.
// But wait, user has tailwindcss ^4.1.17 in package.json.
// In v4, using postcss is possible but the new way is via vite plugin.
// Let's see if I can use the standard one.
// Actually, standard 'vite' config for react doesn't need much change for postcss.

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
