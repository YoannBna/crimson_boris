/* ============================================================
   Version et synchronisation
   ============================================================ */

/** Progression d'un telechargement de mise a jour. */
export interface DownloadProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

export type SyncState =
  | 'inconnu'      /* jamais verifie depuis le demarrage      */
  | 'verification' /* interrogation du depot en cours          */
  | 'a-jour'       /* la version locale est la plus recente    */
  | 'disponible'   /* une version plus recente existe          */
  | 'hors-ligne'   /* le depot n'a pas pu etre joint           */
  | 'non-configure'/* aucun depot distant declare              */
  | 'telechargement'/* mise a jour en cours de recuperation    */
  | 'prete'        /* telechargee, en attente de redemarrage   */

/**
 * Ce que le bouton de mise a jour declenche, selon la plateforme.
 *
 * `install` : telechargement puis redemarrage, pris en charge par
 *             electron-updater. Windows uniquement.
 * `open`    : ouverture de la page des versions dans le navigateur.
 *             Seule voie sur macOS non signe, ou Squirrel refuse
 *             d'appliquer un paquet dont il ne peut verifier la signature.
 * `none`    : aucune action possible — developpement, ou depot absent.
 */
export type UpdateAction = 'install' | 'open' | 'none'

export interface VersionInfo {
  /** Version de l'application, issue de package.json */
  local: string
  /** Horodatage de compilation, injecte au build */
  builtAt: string
  /** Version publiee sur le depot, quand elle est connue */
  remote: string | null
  state: SyncState
  /** ISO — derniere interrogation aboutie ou non */
  checkedAt: string | null
  /** Message affichable, notamment en cas d'echec */
  detail: string | null
  /** URL du depot surveille, sans le jeton eventuel */
  source: string | null
  /** Progression, pendant le telechargement uniquement */
  progress: DownloadProgress | null
  /** true si le canal de mise a jour automatique est operationnel */
  autoUpdate: boolean
  /** Motif d'indisponibilite de la mise a jour automatique */
  autoUpdateBlocker: string | null
  /**
   * Notes de version publiees, converties en TEXTE BRUT par le process
   * principal. Jamais du HTML : ce contenu vient d'un depot distant et
   * n'a rien a faire dans le DOM sous forme de balises.
   */
  releaseNotes: string | null
  /** Ce que fera le bouton d'action sur cette plateforme */
  action: UpdateAction
  /** Page des versions, construite localement — jamais fournie par le distant */
  releasesUrl: string | null
}

/** Compare deux versions semantiques. > 0 si `a` est plus recente. */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}
