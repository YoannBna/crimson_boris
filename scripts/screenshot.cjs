/**
 * Capture de controle : lance Boris hors ligne, photographie l'interface
 * rendue par la coquille Electron, puis quitte.
 * Usage : npx electron scripts/screenshot.cjs <dossier-de-sortie>
 */
const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const outDir = process.argv[2] || path.join(__dirname, '..', 'shots')
const W = 1440
const H = 2800

app.disableHardwareAcceleration()

app.whenReady().then(async () => {
  fs.mkdirSync(outDir, { recursive: true })

  const win = new BrowserWindow({
    width: W,
    height: H,
    show: false,
    backgroundColor: '#121010',
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false }
  })

  await win.loadFile(path.join(__dirname, '..', 'out', 'renderer', 'index.html'))
  await new Promise((r) => setTimeout(r, 1500))

  const total = await win.webContents.executeJavaScript(
    'document.documentElement.scrollHeight'
  )
  console.log('hauteur totale du document :', total)

  const pages = Math.min(4, Math.ceil(total / H))
  for (let i = 0; i < pages; i++) {
    await win.webContents.executeJavaScript(`window.scrollTo(0, ${i * H})`)
    await new Promise((r) => setTimeout(r, 700))
    const img = await win.webContents.capturePage()
    const file = path.join(outDir, `boris-${String(i + 1).padStart(2, '0')}.png`)
    fs.writeFileSync(file, img.toPNG())
    console.log('ecrit :', file)
  }

  app.quit()
})
