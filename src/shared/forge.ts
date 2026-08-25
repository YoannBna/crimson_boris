/* ============================================================
   FORGE MTG — atelier de composition
   ============================================================ */

import type { Card } from './mtg'

/* --- Deck de travail ---------------------------------------- */

/**
 * Une modification en attente. Rien n'est applique au deck importe
 * tant que le plan n'est pas valide : l'atelier reste reversible.
 */
export interface Change {
  id: string
  kind: 'add' | 'cut'
  cardName: string
  /** Carte resolue, quand elle l'est */
  card: Card | null
  /** Ce qui a motive la modification */
  because: string
  /** Origine : directive ecrite, recommandation, ou geste manuel */
  source: 'directive' | 'recommandation' | 'manuel'
}

export interface Workbench {
  deckName: string
  /** Total format actuel, commandant compris */
  baseTotal: number
  /** Total apres application du plan */
  projectedTotal: number
  changes: Change[]
  /** Etat du plan vis-a-vis de la limite des 100 cartes */
  verdict: { ok: boolean; delta: number; message: string }
}

/* --- Directives ecrites ------------------------------------- */

export type DirectiveVerb = 'ajoute' | 'coupe' | 'remplace'

/** Categorie fonctionnelle visee par une directive. */
export type DirectiveTarget =
  | 'pioche'
  | 'removal'
  | 'wrath'
  | 'ramp'
  | 'exutoire'
  | 'drain'
  | 'jetons'
  | 'anthem'
  | 'recursion'
  | 'protection'
  | 'terrain'
  | 'creature'

export interface DirectiveConstraints {
  /** Cout converti maximal */
  maxCmc?: number
  /** Prix maximal en euros */
  maxPrice?: number
  /** Couleur exigee, ex. 'R' */
  color?: string
  /**
   * Attribut recherche, pas intention : `true` cible les terrains qui
   * entrent ENGAGES, `false` ceux qui entrent degages. Sans cette
   * convention, « ajoute des terrains degages » et « retire les terrains
   * engages » produiraient le meme critere.
   */
  entersTapped?: boolean
}

export interface Directive {
  /** Ligne saisie, conservee telle quelle */
  raw: string
  /** Vise les cartes que la simulation voit rester en main */
  dormant?: boolean
  verb: DirectiveVerb
  quantity: number
  target?: DirectiveTarget
  /** Nom de carte explicite, quand la directive en cite un */
  cardName?: string
  /** Pour « remplace X par ... » */
  replacement?: { target?: DirectiveTarget; cardName?: string }
  constraints: DirectiveConstraints
}

export interface DirectiveIssue {
  raw: string
  reason: string
}

export interface DirectivePlan {
  understood: Directive[]
  /** Lignes non interpretees — jamais avalees en silence */
  rejected: DirectiveIssue[]
  changes: Change[]
  /** Compte rendu textuel de ce que Boris a fait de chaque directive */
  report: string[]
  /** Total projete si le plan etait applique tel quel */
  projectedTotal: number
}

/* --- Recommandations statiques ------------------------------ */

export type AdviceId =
  | 'off-identity'
  | 'duplicate'
  | 'tapped-lands'
  | 'curve-top-heavy'
  | 'category-thin'
  | 'dead-weight-cut'
  | 'over-format'

export type AdviceGrade = 'critique' | 'important' | 'mineur'

export interface Advice {
  id: AdviceId
  grade: AdviceGrade
  title: string
  /** Constat chiffre */
  measure: string
  /** Lecture de Boris */
  reading: string
  /** Cartes concernees, nommees */
  cards: string[]
  /** Modification proposee, applicable en un geste */
  proposal?: { kind: 'add' | 'cut'; target?: DirectiveTarget; quantity: number }
}

/* --- Recherche dans le pool --------------------------------- */

export interface PoolQuery {
  text: string
  /** Restreint a l'identite couleur du commandant */
  legalOnly: boolean
  maxPrice?: number
}

export interface PoolResult {
  query: string
  /** Requete Scryfall reellement envoyee */
  scryfall: string
  cards: Card[]
  truncated: boolean
}

/* --- API ---------------------------------------------------- */

export interface ForgeAPI {
  getWorkbench(): Promise<Workbench | null>
  /** Analyse statique de la liste, hors simulation */
  advise(): Promise<Advice[]>

  searchPool(query: PoolQuery): Promise<PoolResult>

  /** Interprete un bloc de directives et retourne un plan, sans l'appliquer */
  planDirectives(text: string): Promise<DirectivePlan>

  addChange(change: Omit<Change, 'id'>): Promise<Workbench>
  dropChange(id: string): Promise<Workbench>
  clearChanges(): Promise<Workbench>
  /** Ecrit le plan dans un nouvel export, sans toucher au fichier d'origine */
  exportPlan(): Promise<{ path: string; lines: number }>
}
