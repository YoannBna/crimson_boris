import type { Card } from '@shared/mtg'
import { getDb } from './db'

/**
 * Cache local des cartes Scryfall.
 *
 * Duree de vie de 24 h : le texte oracle ne bouge jamais, mais les prix
 * sont reactualises quotidiennement chez Scryfall et ce sont eux qui
 * fondent les suggestions budget.
 */
const TTL_MS = 24 * 60 * 60 * 1000

/**
 * Cle de comparaison des noms.
 *
 * Les diacritiques sautent : un export ecrit « Bartolome del Presidio »
 * la ou Scryfall publie « Bartolomé del Presidio », et la carte serait
 * declaree introuvable pour un accent.
 */
export function nameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Toutes les cles sous lesquelles une carte doit etre retrouvable :
 * son nom complet, et chacune de ses faces.
 *
 * Scryfall nomme les recto-verso « Face avant // Face arriere », alors
 * qu'un export ne cite qu'une seule face — parfois l'arriere, comme
 * « Fell Mire » pour « Fell the Profane // Fell Mire ».
 */
export function keysFor(name: string): string[] {
  const keys = new Set<string>([nameKey(name)])
  if (name.includes('//')) {
    for (const face of name.split('//')) {
      const k = nameKey(face)
      if (k) keys.add(k)
    }
  }
  return [...keys]
}

export function getCached(names: string[]): { hits: Map<string, Card>; misses: string[] } {
  const hits = new Map<string, Card>()
  const misses: string[] = []
  if (names.length === 0) return { hits, misses }

  const db = getDb()
  const stmt = db.prepare('SELECT payload, fetched_at FROM cards WHERE name_key = ?')
  const now = Date.now()

  for (const name of names) {
    const row = stmt.get(nameKey(name)) as { payload: string; fetched_at: string } | undefined
    if (!row || now - new Date(row.fetched_at).getTime() > TTL_MS) {
      misses.push(name)
      continue
    }
    try {
      hits.set(nameKey(name), JSON.parse(row.payload) as Card)
    } catch {
      misses.push(name)
    }
  }

  return { hits, misses }
}

export function putCards(cards: Card[]): void {
  const db = getDb()
  const stmt = db.prepare(
    'INSERT INTO cards (name_key, payload, fetched_at) VALUES (?, ?, ?) ' +
      'ON CONFLICT(name_key) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at'
  )
  const now = new Date().toISOString()
  const tx = db.transaction((rows: Card[]) => {
    for (const c of rows) {
      const payload = JSON.stringify(c)
      for (const key of keysFor(c.name)) stmt.run(key, payload, now)
    }
  })
  tx(cards)
}

export function cacheSize(): number {
  const row = getDb().prepare('SELECT COUNT(*) AS n FROM cards').get() as { n: number }
  return row.n
}
