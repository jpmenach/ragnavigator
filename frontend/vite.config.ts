import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // In development the API runs separately (fastapi dev, port 8000). Forwarding /api
    // lets the frontend use the same relative URLs it will use in production, where
    // FastAPI serves both.
    proxy: { '/api': 'http://localhost:8000' },
  },
})
