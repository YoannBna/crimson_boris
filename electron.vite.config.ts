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

/*
 * Coordonnees du depot de publication, injectees depuis
 * electron-builder.yml. Ce fichier ne fait PAS partie de l'application
 * empaquetee : le lire au runtime marchait en developpement et
 * retournait vide une fois installe, laissant le bouton de mise a jour
 * sans destination.
 */
function publishField(name: string): string {
  try {
    const raw = readFileSync(resolve('electron-builder.yml'), 'utf8')
    const m = new RegExp(`^\\s*${name}:\\s*(.+)$`, 'm').exec(raw)
    const v = m?.[1]?.trim() ?? ''
    return v === 'CHANGEME' ? '' : v
  } catch {
    return ''
  }
}
const PUBLISH_OWNER = JSON.stringify(publishField('owner'))
const PUBLISH_REPO = JSON.stringify(publishField('repo'))

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: {
      __BUILD_STAMP__: BUILD_STAMP,
      __APP_VERSION__: APP_VERSION,
      __PUBLISH_OWNER__: PUBLISH_OWNER,
      __PUBLISH_REPO__: PUBLISH_REPO
    },
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
