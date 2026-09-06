import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cesium from 'vite-plugin-cesium'

export default defineConfig({
  plugins: [react(), cesium()],
  resolve: {
    dedupe: ['react', 'react-dom']
  },
  optimizeDeps: {
    exclude: ['resium']
  },
  server: {
    port: 5174, // different port to avoid conflict with phase7 if both are running
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      '/ws':  { target: 'ws://localhost:8000',  ws: true, changeOrigin: true },
    },
  },
})
