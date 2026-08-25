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
