import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Forward all /api/* requests to the CRM backend — no CORS issues in dev
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
})

