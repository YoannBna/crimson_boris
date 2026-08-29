import type { ChosenArt } from '@shared/mtg'
import { getDb } from './db'

/*
 * Illustrations choisies.
 *
 * Une table a part, et non un champ du deck : un deck enregistre est un
 * instantane, si bien qu'un retour a une version anterieure effacerait
 * les arts retenus depuis. L'art appartient a la carte, pas a la liste
 * ou elle figure.
 */

interface Row {
  card_name: string
  scryfall_id: string
  set_code: string
  set_name: string
  collector_number: string
  artist: string | null
  image_normal: string | null
  price_eur: number | null
  chosen_at: string
}

function toArt(r: Row): ChosenArt {
  return {
    cardName: r.card_name,
    scryfallId: r.scryfall_id,
    setCode: r.set_code,
    setName: r.set_name,
    collectorNumber: r.collector_number,
    artist: r.artist,
    imageNormal: r.image_normal,
    priceEur: r.price_eur,
    chosenAt: r.chosen_at
  }
}

/** Tous les choix, indexes par nom de carte — c'est ainsi que l'interface les cherche. */
export function allArts(): Record<string, ChosenArt> {
  const rows = getDb().prepare('SELECT * FROM card_arts').all() as Row[]
  const out: Record<string, ChosenArt> = {}
  for (const r of rows) out[r.card_name] = toArt(r)
  return out
}

export function chooseArt(a: Omit<ChosenArt, 'chosenAt'>): Record<string, ChosenArt> {
  getDb()
    .prepare(
      `INSERT INTO card_arts
         (card_name, scryfall_id, set_code, set_name, collector_number,
          artist, image_normal, price_eur, chosen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(card_name) DO UPDATE SET
         scryfall_id      = excluded.scryfall_id,
         set_code         = excluded.set_code,
         set_name         = excluded.set_name,
         collector_number = excluded.collector_number,
         artist           = excluded.artist,
         image_normal     = excluded.image_normal,
         price_eur        = excluded.price_eur,
         chosen_at        = excluded.chosen_at`
    )
    .run(
      a.cardName,
      a.scryfallId,
      a.setCode,
      a.setName,
      a.collectorNumber,
      a.artist,
      a.imageNormal,
      a.priceEur,
      new Date().toISOString()
    )
  return allArts()
}

/** Retire un choix : la carte revient a l'impression de l'export. */
export function clearArt(cardName: string): Record<string, ChosenArt> {
  getDb().prepare('DELETE FROM card_arts WHERE card_name = ?').run(cardName)
  return allArts()
}
