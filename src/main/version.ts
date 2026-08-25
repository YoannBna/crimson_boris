import { app } from 'electron'
import type { SyncState, VersionInfo } from '@shared/version'
import { compareVersions } from '@shared/version'
import { RequestQueue } from './providers/http'

/*
 * Surveillance de version.
 *
 * Boris interroge un manifeste distant et compare son numero au sien.
 * Il ne se met JAMAIS a jour tout seul depuis le process principal :
 * remplacer son propre binaire pendant qu'il tourne est le meilleur
 * moyen de le corrompre. La mise a jour est le travail du script de
 * demarrage, qui s'execute avant que l'application ne demarre.
 *
 * Deux formes de manifeste sont acceptees :
 *   - l'API GitHub Releases : https://api.github.com/repos/<user>/<repo>/releases/latest
 *   - un JSON statique : { "version": "2.1.0", "notes": "..." }
 */

const UA = 'CrimsonBoris/2.0 (verification de version)'
const queue = new RequestQueue(500, UA)

/** Injectes au build ; valent 'dev' hors compilation. */
declare const __BUILD_STAMP__: string
declare const __APP_VERSION__: string

const BUILT_AT = typeof __BUILD_STAMP__ === 'string' ? __BUILD_STAMP__ : 'dev'

/*
 * `app.getVersion()` renvoie la version d'ELECTRON tant que l'application
 * n'est pas empaquetee — 43.4.1 au lieu de 2.0.0. Toute comparaison de
 * version en devenait absurde. On lit donc le numero injecte depuis
 * package.json, valable dans les deux modes.
 */
const LOCAL_VERSION =
  typeof __APP_VERSION__ === 'string' && __APP_VERSION__ !== ''
    ? __APP_VERSION__
    : app.getVersion()

let info: VersionInfo = {
  local: LOCAL_VERSION,
  builtAt: BUILT_AT,
  remote: null,
  state: 'inconnu',
  checkedAt: null,
  detail: null,
  source: null,
  progress: null,
  autoUpdate: false,
  autoUpdateBlocker: null
}

/** Applique une modification partielle et diffuse le nouvel etat. */
export function patchVersion(patch: Partial<VersionInfo>): VersionInfo {
  info = { ...info, ...patch }
  broadcaster?.(info)
  return info
}

let broadcaster: ((v: VersionInfo) => void) | null = null

/** Le process principal fournit ici son canal de diffusion vers le renderer. */
export function onVersionChange(fn: (v: VersionInfo) => void): void {
  broadcaster = fn
}

export function currentVersion(): VersionInfo {
  return info
}

/** URL du manifeste, definie par variable d'environnement. */
export function manifestUrl(): string | null {
  const url = process.env['BORIS_UPDATE_URL']?.trim()
  return url && url !== '' ? url : null
}

interface GithubRelease {
  tag_name?: string
  name?: string
  body?: string
  html_url?: string
}

interface StaticManifest {
  version?: string
  notes?: string
}

export async function checkVersion(): Promise<VersionInfo> {
  const url = manifestUrl()

  if (!url) {
    info = {
      ...info,
      state: 'non-configure',
      checkedAt: new Date().toISOString(),
      detail:
        "Aucun depot declare. Definis BORIS_UPDATE_URL pour activer la surveillance de version.",
      source: null
    }
    return info
  }

  info = { ...info, state: 'verification' }

  try {
    const raw = await queue.getJson<GithubRelease & StaticManifest>(url)
    const remote = (raw.tag_name ?? raw.version ?? '').replace(/^v/, '')

    if (remote === '') {
      throw new Error('manifeste sans numero de version')
    }

    const behind = compareVersions(remote, info.local) > 0
    const state: SyncState = behind ? 'disponible' : 'a-jour'

    info = {
      ...info,
      remote,
      state,
      checkedAt: new Date().toISOString(),
      detail: behind
        ? `Version ${remote} publiee. Elle sera appliquee au prochain lancement par le script de demarrage.`
        : null,
      source: url
    }
  } catch (err) {
    // Une verification ratee n'est pas une panne : Boris continue de
    // tourner sur sa version locale, il le signale simplement.
    info = {
      ...info,
      state: 'hors-ligne',
      checkedAt: new Date().toISOString(),
      detail: err instanceof Error ? err.message : String(err),
      source: url
    }
  }

  return info
}
