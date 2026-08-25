import { app } from 'electron'
import type { DownloadProgress } from '@shared/version'

/*
 * Mise a jour automatique via GitHub Releases.
 *
 * Le cycle est : interrogation au demarrage, telechargement en tache de
 * fond si une version plus recente existe, puis proposition de
 * redemarrer. Boris ne redemarre JAMAIS de lui-meme : couper une session
 * de travail sans prevenir serait pire que rester d'une version en retard.
 *
 * ---------------------------------------------------------------------
 * LIMITE STRUCTURELLE SUR macOS
 *
 * Squirrel.Mac, le mecanisme employe par Electron, verifie la signature
 * du paquet avant de l'appliquer. Sans certificat Apple Developer ID,
 * la mise a jour se telecharge puis echoue au moment de l'installation.
 * Ce n'est pas un defaut de configuration : c'est une exigence du
 * systeme. Le canal automatique est donc desactive sur macOS non signe,
 * et le script de lancement prend le relais.
 *
 * Sur Windows, l'installeur NSIS s'applique sans signature — avec un
 * avertissement SmartScreen au premier lancement.
 * ---------------------------------------------------------------------
 */

export interface UpdaterEvents {
  onChecking: () => void
  onAvailable: (version: string) => void
  onNone: (version: string) => void
  onProgress: (p: DownloadProgress) => void
  onReady: (version: string) => void
  onError: (message: string) => void
}

let started = false
let quitting = false

/** Motif pour lequel la mise a jour automatique ne peut pas fonctionner. */
export function autoUpdateBlocker(): string | null {
  if (!app.isPackaged) {
    return "Mise a jour automatique inactive en developpement : elle ne s'applique qu'a une application empaquetee."
  }
  if (process.platform === 'darwin') {
    // `isPackaged` ne dit rien de la signature ; on se fie au fait qu'une
    // application non signee ne peut pas etre mise a jour par Squirrel.
    return (
      "Mise a jour automatique indisponible sur macOS : Squirrel exige une application signee " +
      "par un certificat Apple Developer ID. Le script de lancement assure la releve."
    )
  }
  return null
}

export async function startUpdater(events: UpdaterEvents): Promise<void> {
  if (started) return
  started = true

  const blocker = autoUpdateBlocker()
  if (blocker) {
    events.onError(blocker)
    return
  }

  const { autoUpdater } = await import('electron-updater')

  // Telechargement en tache de fond, installation differee au choix de
  // l'operateur : c'est lui qui decide quand sa session s'interrompt.
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = false

  autoUpdater.on('checking-for-update', () => events.onChecking())
  autoUpdater.on('update-available', (info) => events.onAvailable(info.version))
  autoUpdater.on('update-not-available', (info) => events.onNone(info.version))
  autoUpdater.on('download-progress', (p) =>
    events.onProgress({
      percent: Math.round(p.percent),
      transferred: p.transferred,
      total: p.total,
      bytesPerSecond: Math.round(p.bytesPerSecond)
    })
  )
  autoUpdater.on('update-downloaded', (info) => events.onReady(info.version))
  autoUpdater.on('error', (err) =>
    events.onError(err instanceof Error ? err.message : String(err))
  )

  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    events.onError(err instanceof Error ? err.message : String(err))
  }
}

/** Applique la mise a jour telechargee. Appele uniquement sur accord explicite. */
export async function installNow(): Promise<void> {
  if (quitting) return
  quitting = true
  const { autoUpdater } = await import('electron-updater')
  // `isSilent = false` laisse l'installeur visible : l'operateur voit ce
  // qui se passe sur sa machine.
  autoUpdater.quitAndInstall(false, true)
}
