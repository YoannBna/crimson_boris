/* ============================================================
   Configuration de l'operateur
   ============================================================ */

export type ConnectorId = 'mail' | 'markets' | 'archidekt'

export type ConnectorState = 'absent' | 'configure' | 'ignore'

/** Reglages non secrets — stockes en clair, ils ne revelent rien. */
export interface OperatorProfile {
  /** Nom affiche dans le bandeau. Libre, jamais transmis. */
  displayName: string
  /** Fuseau pour l'horloge et les echeances */
  timeZone: string
  /** Symboles suivis par le radar financier */
  tickers: string[]
  /** Flux RSS surveilles par le module de veille */
  feeds: string[]
}

export interface ConnectorStatus {
  id: ConnectorId
  state: ConnectorState
  /** Libelle du compte relie, jamais le secret lui-meme */
  account: string | null
}

export interface AppConfig {
  /** false tant que l'ecran d'accueil n'a pas ete valide */
  onboarded: boolean
  profile: OperatorProfile
  connectors: ConnectorStatus[]
  /** true si le systeme d'exploitation fournit un coffre chiffre */
  secureStorageAvailable: boolean
}

/**
 * Champs secrets attendus par chaque connecteur.
 * Leur VALEUR ne transite jamais vers le renderer : seule la presence
 * est exposee.
 */
export const CONNECTOR_FIELDS: Record<
  ConnectorId,
  { key: string; label: string; hint: string; optional?: boolean }[]
> = {
  mail: [
    { key: 'IMAP_HOST', label: 'Serveur IMAP', hint: 'ex. imap.gmail.com' },
    { key: 'IMAP_USER', label: 'Adresse', hint: 'ton adresse electronique' },
    {
      key: 'IMAP_PASSWORD',
      label: 'Mot de passe d’application',
      hint: 'jamais ton mot de passe principal — un mot de passe dedie'
    }
  ],
  markets: [
    {
      key: 'MARKETS_API_KEY',
      label: 'Cle API (facultative)',
      hint: 'la source par defaut ne demande aucune cle',
      optional: true
    }
  ],
  archidekt: [
    { key: 'ARCHIDEKT_USER', label: 'Nom d’utilisateur', hint: 'ton compte Archidekt' },
    {
      key: 'ARCHIDEKT_TOKEN',
      label: 'Jeton d’API (facultatif)',
      hint: 'seulement pour les decks prives',
      optional: true
    }
  ]
}

export const DEFAULT_PROFILE: OperatorProfile = {
  displayName: '',
  timeZone: 'Europe/Paris',
  tickers: ['^FCHI', '^GSPC', '^IXIC', 'BZ=F', 'GC=F', 'EURUSD=X', 'BTC-USD'],
  feeds: []
}

export interface ConfigAPI {
  get(): Promise<AppConfig>
  saveProfile(profile: Partial<OperatorProfile>): Promise<AppConfig>
  /** Ecrit un secret dans le coffre du systeme. La valeur ne ressort jamais. */
  setSecret(connector: ConnectorId, key: string, value: string): Promise<AppConfig>
  clearConnector(connector: ConnectorId): Promise<AppConfig>
  skipConnector(connector: ConnectorId): Promise<AppConfig>
  complete(): Promise<AppConfig>
  /** Efface toutes les donnees locales — profil, secrets, base */
  purge(): Promise<void>
}
