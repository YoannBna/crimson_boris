import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

/* Horodatage de compilation : c'est lui qui distingue deux binaires
 * portant le meme numero de version. */
const BUILD_STAMP = JSON.stringify(new Date().toISOString())

/* Version applicative injectee depuis package.json.
 * `app.getVersion()` ne la retourne PAS hors application empaquetee : il
 * renvoie alors la version d'Electron, ce qui fausse toute comparaison. */
const APP_VERSION = JSON.stringify(
  JSON.parse(readFileSync(resolve('package.json'), 'utf8')).version
)

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: { __BUILD_STAMP__: BUILD_STAMP, __APP_VERSION__: APP_VERSION },
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  renderer: {
    root: resolve('src/renderer'),
    build: {
      rollupOptions: { input: { index: resolve('src/renderer/index.html') } }
    },
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()]
  }
})
