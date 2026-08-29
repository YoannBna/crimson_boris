import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'

let win: BrowserWindow | null = null
let quitting = false

export function markQuitting(): void {
  quitting = true
}

export function getWindow(): BrowserWindow | null {
  return win
}

export function createWindow(show: boolean): BrowserWindow {
  if (win && !win.isDestroyed()) return win

  win = new BrowserWindow({
    width: 1560,
    height: 980,
    minWidth: 960,
    minHeight: 620,
    show: false,
    backgroundColor: '#121010',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => {
    if (show) win?.show()
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  /*
   * Fermer la fenetre ne ferme pas Boris : il continue son cycle depuis
   * la barre de menus. Seul "Quitter" met reellement fin au processus.
   */
  win.on('close', (e) => {
    if (quitting) return
    e.preventDefault()
    win?.hide()
    if (process.platform === 'darwin') app.dock?.hide()
  })

  // `BORIS_LEGACY` rouvre l'ancienne interface, conservee le temps de
  // quelques versions. Sans lui, c'est la coquille qui se monte.
  const query = process.env['BORIS_LEGACY'] ? { search: '?legacy' } : {}

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const url = process.env['ELECTRON_RENDERER_URL'] + (query.search ?? '')
    void win.loadURL(url)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), query)
  }

  return win
}

/**
 * Amene Boris a l'ecran.
 * @param focus false = la fenetre apparait sans voler le focus courant.
 */
export function revealWindow(focus = true): void {
  const w = createWindow(true)
  if (process.platform === 'darwin') void app.dock?.show()
  if (w.isMinimized()) w.restore()
  if (focus) {
    w.show()
    w.focus()
  } else {
    w.showInactive()
  }
}

export function broadcast(channel: string, payload: unknown): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send(channel, payload)
  }
}
