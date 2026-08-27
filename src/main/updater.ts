import { app, shell } from 'electron'
import type { DownloadProgress, UpdateAction } from '@shared/version'

/*
 * Mise a jour — mode manuel et interactif.
 *
 * Boris VERIFIE au demarrage mais ne telecharge rien de lui-meme :
 * `autoDownload` est desactive. Cent trente megaoctets tires sur la
 * connexion de quelqu'un sans son accord, c'est une decision qui ne
 * revient pas a l'application.
 *
 * L'operateur voit un indicateur changer de couleur, ouvre le panneau,
 * lit ce que la version apporte, et decide.
 *
 * ---------------------------------------------------------------------
 * DEUX CHEMINS, SELON LA PLATEFORME
 *
 * Windows — l'installeur NSIS s'applique sans signature. Le bouton
 * telecharge puis redemarre : `downloadUpdate()` puis `quitAndInstall()`.
 *
 * macOS — Squirrel.Mac verifie la signature du paquet avant de
 * l'appliquer. Sans certificat Apple Developer ID, `quitAndInstall()`
 * echoue APRES avoir telecharge : l'operateur attend, puis rien. Plutot
 * que de lui faire perdre ce temps, le bouton ouvre la page des versions
 * dans son navigateur pour qu'il recupere le .dmg lui-meme.
 * ---------------------------------------------------------------------
 */

/*
 * Coordonnees du depot, injectees au build depuis electron-builder.yml.
 * Les lire au runtime echouait une fois l'application empaquetee : ce
 * fichier ne fait pas partie du bundle.
 */
declare const __PUBLISH_OWNER__: string
declare const __PUBLISH_REPO__: string

const OWNER = typeof __PUBLISH_OWNER__ === 'string' ? __PUBLISH_OWNER__ : ''
const REPO = typeof __PUBLISH_REPO__ === 'string' ? __PUBLISH_REPO__ : ''

/*
 * L'adresse est reconstruite ici, a partir de valeurs figees a la
 * compilation, et jamais reprise d'une reponse du serveur.
 * `shell.openExternal` ouvre ce qu'on lui donne : une URL venue du
 * reseau y serait une porte d'entree.
 */
export function releasesUrl(): string | null {
  if (OWNER === '' || REPO === '') return null
  const safe = (v: string): string => v.replace(/[^A-Za-z0-9._-]/g, '')
  return `https://github.com/${safe(OWNER)}/${safe(REPO)}/releases/latest`
}

/** Ce que le bouton d'action peut faire sur cette plateforme. */
export function updateAction(): UpdateAction {
  if (!app.isPackaged) return 'none'
  if (process.platform === 'darwin') return releasesUrl() ? 'open' : 'none'
  return 'install'
}

/** Motif pour lequel l'installation en place est impossible. */
export function autoUpdateBlocker(): string | null {
  if (!app.isPackaged) {
    return "Verification inactive en developpement : elle ne s'applique qu'a une application empaquetee."
  }
  if (process.platform === 'darwin') {
    return (
      "Sur macOS, l'installation en place exige une application signee par un certificat Apple " +
      'Developer ID. Le bouton ouvre la page des versions pour un telechargement manuel.'
    )
  }
  return null
}

/**
 * Notes de version en TEXTE BRUT.
 * GitHub renvoie du HTML ; l'injecter dans le DOM reviendrait a executer
 * du balisage venu du reseau. On le reduit ici, une fois pour toutes.
 */
export function plainNotes(notes: unknown): string | null {
  const raw = Array.isArray(notes)
    ? notes.map((n) => (typeof n === 'string' ? n : ((n as { note?: string })?.note ?? ''))).join('\n')
    : typeof notes === 'string'
      ? notes
      : ''

  const text = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|h\d)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return text === '' ? null : text.slice(0, 4000)
}

/*
 * Acces a `autoUpdater`.
 *
 * electron-updater est un module CommonJS. Dans le bundle du process
 * principal, `await import()` le fait remonter tantot a plat, tantot
 * sous `.default` selon l'interop appliquee. Le deballer directement
 * donnait `undefined` une fois l'application empaquetee — et tout le
 * canal de mise a jour restait inerte, sans la moindre erreur visible
 * au lancement.
 */
async function updater(): Promise<import('electron-updater').AppUpdater> {
  const mod = (await import('electron-updater')) as unknown as {
    autoUpdater?: import('electron-updater').AppUpdater
    default?: { autoUpdater?: import('electron-updater').AppUpdater }
  }
  const u = mod.autoUpdater ?? mod.default?.autoUpdater
  if (!u) throw new Error("electron-updater : 'autoUpdater' introuvable dans le module.")
  return u
}

export interface UpdaterEvents {
  onChecking: () => void
  onAvailable: (version: string, notes: string | null) => void
  onNone: (version: string) => void
  onProgress: (p: DownloadProgress) => void
  onReady: (version: string) => void
  onError: (message: string) => void
}

let started = false

export async function startUpdater(events: UpdaterEvents): Promise<void> {
  if (started) return
  started = true

  if (!app.isPackaged) {
    events.onError(autoUpdateBlocker() ?? 'verification indisponible')
    return
  }

  const autoUpdater = await updater()

  // Le coeur du mode manuel : on regarde, on ne prend rien.
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowPrerelease = false

  autoUpdater.on('checking-for-update', () => events.onChecking())
  autoUpdater.on('update-available', (info) =>
    events.onAvailable(info.version, plainNotes(info.releaseNotes))
  )
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

/** Relance une verification aupres du depot. */
export async function recheck(): Promise<void> {
  if (!app.isPackaged) return
  const autoUpdater = await updater()
  await autoUpdater.checkForUpdates()
}

/** Lance le telechargement. Windows uniquement — sur macOS il serait perdu. */
export async function downloadUpdate(): Promise<void> {
  if (updateAction() !== 'install') {
    throw new Error("Le telechargement en place n'est pas disponible sur cette plateforme.")
  }
  const autoUpdater = await updater()
  await autoUpdater.downloadUpdate()
}

/** Redemarre et applique le paquet deja telecharge. */
export async function installNow(): Promise<void> {
  if (updateAction() !== 'install') {
    throw new Error("L'installation en place n'est pas disponible sur cette plateforme.")
  }
  const autoUpdater = await updater()
  autoUpdater.quitAndInstall(false, true)
}

/** Ouvre la page des versions — voie de secours sur macOS. */
export async function openReleases(): Promise<void> {
  const url = releasesUrl()
  if (!url) throw new Error('Aucun depot de publication declare.')
  await shell.openExternal(url)
}
