import type { ResolvedDeck, SimResult } from '@shared/mtg'
import { getDb } from './db'

export function saveDeck(deck: ResolvedDeck): void {
  getDb()
    .prepare(
      'INSERT INTO decks (name, source_file, imported_at, payload) VALUES (?, ?, ?, ?)'
    )
    .run(deck.name, deck.sourceFile, deck.importedAt, JSON.stringify(deck))
}

export function latestDeck(): ResolvedDeck | null {
  const row = getDb()
    .prepare('SELECT payload FROM decks ORDER BY id DESC LIMIT 1')
    .get() as { payload: string } | undefined
  return row ? (JSON.parse(row.payload) as ResolvedDeck) : null
}

export function saveRun(run: SimResult): void {
  getDb()
    .prepare(
      'INSERT INTO sim_runs (run_at, deck_name, games, opponents, payload) VALUES (?, ?, ?, ?, ?)'
    )
    .run(
      run.runAt,
      run.deckName,
      run.config.games,
      run.config.opponents,
      JSON.stringify(run)
    )
}

export function latestRun(): SimResult | null {
  const row = getDb()
    .prepare('SELECT payload FROM sim_runs ORDER BY id DESC LIMIT 1')
    .get() as { payload: string } | undefined
  return row ? (JSON.parse(row.payload) as SimResult) : null
}

/** Historique condense — sert a suivre l'effet des modifications de deck. */
export function runHistory(limit = 20): {
  runAt: string
  deckName: string
  games: number
  opponents: number
}[] {
  return getDb()
    .prepare(
      'SELECT run_at AS runAt, deck_name AS deckName, games, opponents ' +
        'FROM sim_runs ORDER BY id DESC LIMIT ?'
    )
    .all(limit) as { runAt: string; deckName: string; games: number; opponents: number }[]
}

/*
 * Pile de versions.
 *
 * Chaque application de plan ajoute une ligne : l'historique est le
 * tableau `decks` lui-meme. Revenir en arriere ne supprime rien — la
 * version choisie est recopiee en tete, si bien qu'on peut toujours
 * repartir en avant.
 */

export interface DeckRow {
  id: number
  name: string
  imported_at: string
  payload: string
}

export function deckVersions(limit = 40): DeckRow[] {
  return getDb()
    .prepare('SELECT id, name, imported_at, payload FROM decks ORDER BY id DESC LIMIT ?')
    .all(limit) as DeckRow[]
}

export function deckById(id: number): ResolvedDeck | null {
  const row = getDb().prepare('SELECT payload FROM decks WHERE id = ?').get(id) as
    | { payload: string }
    | undefined
  return row ? (JSON.parse(row.payload) as ResolvedDeck) : null
}

/** Enregistre un deck et retourne l'identifiant de la version creee. */
export function saveDeckReturningId(deck: ResolvedDeck): number {
  const info = getDb()
    .prepare('INSERT INTO decks (name, source_file, imported_at, payload) VALUES (?, ?, ?, ?)')
    .run(deck.name, deck.sourceFile, deck.importedAt, JSON.stringify(deck))
  return Number(info.lastInsertRowid)
}

/**
 * Identifiant de la derniere version, ou -1 si la pile est vide.
 * Sert de repere aux epreuves, qui doivent rendre la base telle
 * qu'elles l'ont trouvee.
 */
export function lastDeckId(): number {
  const row = getDb().prepare('SELECT MAX(id) AS id FROM decks').get() as { id: number | null }
  return row.id ?? -1
}

/**
 * Supprime les versions posterieures a un repere.
 *
 * Reserve aux epreuves. Elles s'executent dans l'application reelle,
 * donc sur la vraie base : sans ce nettoyage, un deck d'essai de dix
 * cartes reste en tete de pile et remplace la liste de l'operateur a
 * l'ecran. Le defaut a ete constate, pas suppose.
 */
export function dropDeckVersionsAfter(id: number): number {
  const info = getDb().prepare('DELETE FROM decks WHERE id > ?').run(id)
  return info.changes
}
