/**
 * Serveur de rendu autonome — permet d'inspecter l'interface de Boris
 * dans un navigateur, hors coquille Electron (window.boris est alors absent).
 * Usage : npm run dev:web
 */
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: resolve('src/renderer'),
  resolve: {
    alias: {
      '@': resolve('src/renderer/src'),
      '@shared': resolve('src/shared')
    }
  },
  plugins: [react()],
  server: { port: 5199, strictPort: true }
})
