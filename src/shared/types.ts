/* ============================================================
   Contrat partage MAIN <-> RENDERER
   ============================================================ */

export type TriggerSource =
  | 'boot'        /* demarrage de l'application         */
  | 'interval'    /* cycle regulier du scheduler        */
  | 'resume'      /* sortie de veille systeme           */
  | 'unlock'      /* deverrouillage de session          */
  | 'active'      /* retour de l'operateur (macOS)      */
  | 'clock-jump'  /* filet de securite : saut d'horloge */
  | 'manual'      /* declenche depuis l'interface       */

/** Gravite du cycle. `critical` autorise Boris a s'imposer au premier plan. */
export type Severity = 'nominal' | 'watch' | 'critical'

/** Une regle de gravite qui s'est declenchee pendant le cycle. */
export interface SeverityHit {
  rule: SeverityRuleId
  label: string
  detail: string
  severity: Severity
}

export type SeverityRuleId =
  | 'task-overdue'      /* tache SANS DELAI non cloturee     */
  | 'market-shock'      /* seuil de marche franchi           */
  | 'deadline-shift'    /* echeance qui bascule              */
  | 'first-wake'        /* premier reveil de la journee      */

export interface CoreStatus {
  /** false = Boris suspendu manuellement depuis le Tray */
  active: boolean
  /** ISO — dernier cycle acheve */
  lastCycle: string | null
  /** ISO — prochain cycle planifie */
  nextCycle: string | null
  lastTrigger: TriggerSource
  /** Duree du dernier cycle, en millisecondes */
  lastDurationMs: number | null
  severity: Severity
  hits: SeverityHit[]
  modulesFed: number
  modulesTotal: number
  /** true pendant qu'un cycle est en cours */
  running: boolean
  settings: Settings
}

export interface Settings {
  /** Intervalle entre deux cycles, en minutes */
  intervalMinutes: number
  /** Lancement a l'ouverture de session, masque */
  launchAtLogin: boolean
  /** Autorise Boris a passer au premier plan sur cycle critique */
  revealOnCritical: boolean
  /**
   * Delai minimal, en minutes, avant que Boris ne s'impose une seconde fois
   * pour des signaux identiques. Neutralise le harcelement des conditions
   * durables (une tache sans delai reste vraie tant qu'elle n'est pas faite)
   * sans jamais retarder un signal nouveau.
   */
  revealCooldownMinutes: number
}

/* --- Taches ------------------------------------------------ */

export type DueClass = 'due-now' | 'due-soon' | 'due-far'

export interface TaskState {
  id: string
  done: boolean
  /** ISO — date de cloture */
  doneAt: string | null
}

/* --- Marches ----------------------------------------------- */

/**
 * Volet d'affichage d'une cotation.
 * `core` : les indices directeurs, soumis aux seuils de choc.
 * `asymmetry` : les paris de rupture, suivis sans seuil — leur volatilite
 * normale declencherait une alerte a chaque cycle.
 */
export type QuoteCategory = 'core' | 'asymmetry'

export interface MarketQuote {
  /** Identifiant interne, stable */
  id: string
  category: QuoteCategory
  /** Libelle affiche */
  label: string
  /** Symbole chez le fournisseur */
  symbol: string
  price: number | null
  previousClose: number | null
  changePercent: number | null
  currency: string | null
  /** ISO — horodatage de la cotation */
  asOf: string | null
  /** Renseigne si la recuperation a echoue */
  error?: string
}

export interface MarketSnapshot {
  /** ISO — fin de la collecte */
  fetchedAt: string
  quotes: MarketQuote[]
  /** Nombre de symboles recuperes avec succes */
  ok: number
  total: number
}

/** Seuil declenchant une alerte de choc de marche. */
export interface MarketThreshold {
  quoteId: string
  direction: 'below' | 'above'
  value: number
  label: string
}

/* --- API exposee au renderer ------------------------------- */

import type {
  ResolvedDeck,
  SimConfig,
  SimResult,
  StyleFind,
  Suggestion
} from './mtg'

export interface MtgAPI {
  getDeck(): Promise<ResolvedDeck | null>
  /** Importe le premier export trouve dans le dossier d'accueil */
  importFromFolder(): Promise<ResolvedDeck | null>
  /** Ouvre un selecteur de fichier */
  importDialog(): Promise<ResolvedDeck | null>
  decksDir(): Promise<string>

  getLastRun(): Promise<SimResult | null>
  runSim(config: Partial<SimConfig>): Promise<SimResult>

  /** Suggestions par identifiant de constat */
  getSuggestions(): Promise<Record<string, Suggestion[]>>
  getStyleUpgrades(names?: string[]): Promise<StyleFind[]>
}

export interface BorisAPI {
  config: import('./config').ConfigAPI
  getVersion(): Promise<import('./version').VersionInfo>
  checkVersion(): Promise<import('./version').VersionInfo>
  /** Redemarre et applique la mise a jour deja telechargee */
  installUpdate(): Promise<void>
  onVersion(cb: (v: import('./version').VersionInfo) => void): () => void
  mtg: MtgAPI
  forge: import('./forge').ForgeAPI
  getStatus(): Promise<CoreStatus>
  onStatus(cb: (s: CoreStatus) => void): () => void
  refreshNow(): Promise<CoreStatus>
  setActive(active: boolean): Promise<CoreStatus>
  updateSettings(patch: Partial<Settings>): Promise<CoreStatus>

  getTasks(): Promise<TaskState[]>
  setTaskDone(id: string, done: boolean): Promise<TaskState[]>

  getMarkets(): Promise<MarketSnapshot | null>
  onMarkets(cb: (s: MarketSnapshot) => void): () => void
}
