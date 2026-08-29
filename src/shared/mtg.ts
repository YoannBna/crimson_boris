/* ============================================================
   Arsenal ludique — contrat partage
   ============================================================ */

/** Emplacement d'une carte dans l'export importe. */
export type Slot = 'deck' | 'commander' | 'sideboard' | 'maybeboard' | 'excluded'

/** Une ligne d'export, avant toute resolution Scryfall. */
export interface ParsedLine {
  quantity: number
  name: string
  setCode?: string
  collectorNumber?: string
  /** Etiquettes brutes trouvees entre crochets ou apres une virgule */
  tags: string[]
  slot: Slot
  /** Ligne d'origine, conservee pour le diagnostic */
  raw: string
}

export interface ParseResult {
  format: 'archidekt' | 'moxfield' | 'dec' | 'inconnu'
  lines: ParsedLine[]
  /** Lignes non interpretables — jamais silencieuses */
  rejected: { raw: string; reason: string }[]
  counts: Record<Slot, number>
}

/* --- Carte resolue ----------------------------------------- */

export interface Card {
  /** Identifiant Scryfall de l'oracle (stable entre impressions) */
  oracleId: string
  scryfallId: string
  name: string
  manaCost: string | null
  cmc: number
  typeLine: string
  oracleText: string
  colors: string[]
  colorIdentity: string[]
  power: string | null
  toughness: string | null
  /** Cout de production de mana, deduit du texte */
  producesMana: string[]
  imageSmall: string | null
  imageNormal: string | null
  priceEur: number | null
  priceUsd: number | null
  /** Categories fonctionnelles deduites — voir classify() */
  roles: CardRole[]
  layout: string
  setCode: string
  collectorNumber: string
}

export type CardRole =
  | 'land'
  | 'ramp'
  | 'draw'
  | 'removal'
  | 'wrath'
  | 'sacrifice-outlet'
  | 'token-maker'
  | 'drain'
  | 'anthem'
  | 'recursion'
  | 'protection'
  | 'creature'
  | 'other'

export interface ResolvedDeck {
  name: string
  importedAt: string
  sourceFile: string | null
  commander: Card[]
  /** Cartes du deck principal, dupliquees selon leur quantite */
  main: Card[]
  reserve: Card[]
  /** Noms que Scryfall n'a pas su resoudre */
  unresolved: { name: string; reason: string }[]
  /** Cartes deja possedees en finition speciale (foil, grave...) */
  foils: string[]
  colorIdentity: string[]
  /**
   * Categories Archidekt de l'export, par nom de carte resolu.
   *
   * Optionnel : les decks importes avant que le parseur ne les conserve
   * n'en ont pas, et le classement retombe alors sur les roles deduits.
   * Mieux vaut un repli explicite qu'un champ obligatoire qui ferait
   * echouer la lecture des anciennes versions.
   */
  categories?: Record<string, string[]>
}

/* --- Simulation -------------------------------------------- */

export interface SimConfig {
  /** 1 = duel, 3 = table de commander a quatre */
  opponents: 1 | 3
  games: number
  /** Tour au-dela duquel la partie est arretee */
  maxTurns: number
  /** Graine — une meme graine rejoue exactement la meme serie */
  seed: number
}

/** Photographie d'un tour de jeu. */
export interface TurnRecord {
  turn: number
  landsInPlay: number
  manaAvailable: number
  manaSpent: number
  /** Mana disponible non depense */
  manaWasted: number
  handSize: number
  cardsDrawn: number
  spellsCast: string[]
  creaturesInPlay: number
  /** true si aucun terrain n'a pu etre pose faute de terrain en main */
  landDrop: boolean
}

export interface GameRecord {
  index: number
  mulligans: number
  openingLands: number
  turns: TurnRecord[]
  /** Tour ou la Ne source de mana est arrivee — index 0 = premiere */
  landCurve: number[]
  /** Tours ou une perturbation adverse a frappe */
  disruptions: { turn: number; kind: 'wrath' | 'removal'; hit: string | null }[]
  /** Cartes vues (piochees ou en main d'ouverture) par role */
  rolesSeen: Record<string, number>
  /** Premier tour ou un effet de pioche a ete lance */
  firstDrawSpellTurn: number | null
  /** Premier tour ou une interaction a ete lancee */
  firstInteractionTurn: number | null
  /** Cartes non-terrain encore en main a la fin de la partie */
  stuckInHand: string[]
}

export interface SimResult {
  runAt: string
  config: SimConfig
  deckName: string
  games: GameRecord[]
  findings: Finding[]
}

/* --- Analyse ----------------------------------------------- */

export type FindingId =
  | 'draw-starvation'
  | 'empty-hand'
  | 'interaction-shortage'
  | 'sacrifice-outlet-fragility'
  | 'mana-screw'
  | 'curve-tension'
  | 'dead-weight'

export type FindingGrade = 'critique' | 'desequilibre' | 'tension' | 'nominal'

export interface Finding {
  id: FindingId
  grade: FindingGrade
  title: string
  /** Constat chiffre, sans interpretation */
  measure: string
  /** Lecture de Boris */
  reading: string
  /** Requetes Scryfall proposees pour combler la faille */
  remedies: Remedy[]
}

export interface Remedy {
  label: string
  /** Requete Scryfall complete */
  query: string
}

/* --- Suggestions ------------------------------------------- */

export interface Suggestion {
  card: Card
  /** Pourquoi Boris la propose */
  because: string
  /** Note de pertinence, 0-100 */
  score: number
}

/** Impression alternative d'une carte deja possedee. */
export interface Printing {
  scryfallId: string
  name: string
  setCode: string
  setName: string
  collectorNumber: string
  artist: string | null
  priceEur: number | null
  priceUsd: number | null
  imageNormal: string | null
  fullArt: boolean
  borderColor: string
  frameEffects: string[]
  promo: boolean
  /** Score esthetique deduit des attributs ci-dessus */
  styleScore: number
}

/** Impressions alternatives proposees pour une carte deja possedee. */
export interface StyleFind {
  cardName: string
  /** Impression la moins chere actuellement listee */
  current: { setCode: string; priceEur: number | null } | null
  candidates: Printing[]
}
