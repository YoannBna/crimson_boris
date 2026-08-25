import type { Card, Finding, Printing, ResolvedDeck, StyleFind, Suggestion } from '@shared/mtg'
import { printings, search } from './providers/scryfall'
import { getCached, putCards } from './store/cards'

/*
 * Deux services distincts, souvent confondus :
 *
 *   1. Que faire entrer dans le deck pour combler une faille mesuree.
 *   2. Quelle impression choisir d'une carte deja possedee, pour
 *      qu'elle soit belle sans couter cher.
 *
 * Le premier repond a un diagnostic, le second a un gout.
 */

/* ============================================================
   1 · Cartes a faire entrer
   ============================================================ */

export async function suggestFor(
  findings: Finding[],
  deck: ResolvedDeck,
  opts: { perFinding?: number; maxPriceEur?: number } = {}
): Promise<Map<string, Suggestion[]>> {
  const perFinding = opts.perFinding ?? 6
  const maxPrice = opts.maxPriceEur ?? 12

  // Tout ce que le deck contient deja, reserve comprise : proposer une
  // carte que l'on possede sans la jouer n'aiderait pas.
  const owned = new Set(
    [...deck.commander, ...deck.main, ...deck.reserve].map((c) => c.name.toLowerCase())
  )

  const out = new Map<string, Suggestion[]>()

  for (const f of findings) {
    if (f.remedies.length === 0) continue

    const pool = new Map<string, Suggestion>()

    for (const remedy of f.remedies) {
      let found: Card[]
      try {
        // `edhrec` classe par frequence de jeu reelle : le meilleur
        // indicateur de qualite disponible sans jugement editorial.
        found = await search(remedy.query, { order: 'edhrec', unique: 'cards', limit: 1 })
      } catch (err) {
        console.error('[boris] requete de suggestion en echec :', remedy.query, err)
        continue
      }

      putCards(found)

      for (const [rank, card] of found.entries()) {
        if (owned.has(card.name.toLowerCase())) continue
        if (card.priceEur !== null && card.priceEur > maxPrice) continue
        if (pool.has(card.oracleId)) continue

        pool.set(card.oracleId, {
          card,
          because: remedy.label,
          score: scoreSuggestion(rank, card, maxPrice)
        })
      }
    }

    out.set(
      f.id,
      [...pool.values()].sort((a, b) => b.score - a.score).slice(0, perFinding)
    )
  }

  return out
}

/**
 * Pertinence de jeu d'abord, prix ensuite.
 * Une carte tres jouee et gratuite passe devant une carte rare et chere.
 */
function scoreSuggestion(rank: number, card: Card, maxPrice: number): number {
  const relevance = Math.max(0, 70 - rank * 4)
  const price = card.priceEur ?? card.priceUsd ?? maxPrice
  const affordability = Math.max(0, 30 * (1 - Math.min(price, maxPrice) / maxPrice))
  return Math.round(relevance + affordability)
}

/* ============================================================
   2 · Variantes graphiques a petit prix
   ============================================================ */

/**
 * Pour chaque carte demandee, les impressions les plus soignees dont le
 * prix reste sous le plafond. « Stylee » est deduit des attributs
 * d'impression — sans bordure, pleine illustration, cadre vitrine — car
 * Scryfall ne publie aucune note esthetique.
 */
export async function styleUpgrades(
  names: string[],
  opts: { maxPriceEur?: number; minStyle?: number; perCard?: number } = {}
): Promise<StyleFind[]> {
  const maxPrice = opts.maxPriceEur ?? 5
  const minStyle = opts.minStyle ?? 15
  const perCard = opts.perCard ?? 4

  const out: StyleFind[] = []

  for (const name of names) {
    let all: Printing[]
    try {
      all = await printings(name)
    } catch (err) {
      console.error('[boris] impressions indisponibles pour', name, err)
      continue
    }
    if (all.length === 0) continue

    const priced = all.filter((p) => p.priceEur !== null)
    const cheapest = priced[0] ?? null

    const candidates = all
      .filter((p) => p.styleScore >= minStyle)
      .filter((p) => p.priceEur !== null && p.priceEur <= maxPrice)
      .sort((a, b) => valueRatio(b) - valueRatio(a))
      .slice(0, perCard)

    if (candidates.length === 0) continue

    out.push({
      cardName: name,
      current: cheapest
        ? { setCode: cheapest.setCode, priceEur: cheapest.priceEur }
        : null,
      candidates
    })
  }

  return out
}

/** Style obtenu par euro depense — le plancher a un euro evite la division explosive. */
function valueRatio(p: Printing): number {
  const price = Math.max(p.priceEur ?? 999, 1)
  return p.styleScore / price
}

/**
 * Les cartes du deck qui meritent le plus un traitement graphique.
 * Sont ecartees : les terrains basiques, qui se comptent par dizaines, et
 * les cartes deja possedees en finition speciale — proposer une variante
 * de ce que l'on a deja en foil n'aurait aucun sens.
 */
export function styleCandidatesFrom(deck: ResolvedDeck, limit = 12): string[] {
  const owned = new Set(deck.foils.map((n) => n.toLowerCase()))
  const counts = new Map<string, number>()

  for (const c of [...deck.commander, ...deck.main]) {
    if (/Basic Land/i.test(c.typeLine)) continue
    if (owned.has(c.name.toLowerCase())) continue
    counts.set(c.name, (counts.get(c.name) ?? 0) + 1)
  }
  return [...counts.keys()].slice(0, limit)
}

/** Reservee au diagnostic : verifie que le cache est bien sollicite. */
export function cacheProbe(names: string[]): { hits: number; misses: number } {
  const { hits, misses } = getCached(names)
  return { hits: hits.size, misses: misses.length }
}
