import type { Card, ParseResult, ResolvedDeck } from '@shared/mtg'
import { collection } from '../providers/scryfall'
import { getCached, keysFor, nameKey, putCards } from '../store/cards'

/**
 * Transforme un export analyse en deck resolu.
 *
 * Un export ne contient ni cout de mana, ni type, ni texte : sans cette
 * etape, aucune simulation n'est possible. Le cache absorbe les imports
 * repetes ; seuls les noms inconnus partent sur le reseau.
 */
export async function resolveDeck(
  parsed: ParseResult,
  opts: { name: string; sourceFile: string | null }
): Promise<ResolvedDeck> {
  const wanted = [...new Set(parsed.lines.map((l) => l.name))]
  const { hits, misses } = getCached(wanted)

  const unresolved: { name: string; reason: string }[] = []

  if (misses.length > 0) {
    const { found, missing } = await collection(misses)
    putCards(found)

    // Une carte doit repondre a chacun de ses noms de face, pas seulement
    // au nom complet retourne par Scryfall.
    for (const c of found) {
      for (const key of keysFor(c.name)) hits.set(key, c)
    }
    for (const name of missing) {
      unresolved.push({ name, reason: 'inconnue de Scryfall' })
    }
  }

  const commander: Card[] = []
  const main: Card[] = []
  const reserve: Card[] = []

  for (const line of parsed.lines) {
    const card = hits.get(nameKey(line.name))
    if (!card) {
      if (!unresolved.some((u) => u.name === line.name)) {
        unresolved.push({ name: line.name, reason: 'non resolue' })
      }
      continue
    }
    const target =
      line.slot === 'commander' ? commander : line.slot === 'deck' ? main : reserve
    for (let i = 0; i < line.quantity; i++) target.push(card)
  }

  const foils = [
    ...new Set(
      parsed.lines
        .filter((l) => l.tags.some((t) => t.toLowerCase() === 'foil'))
        .map((l) => l.name)
    )
  ]

  const identity = new Set<string>()
  for (const c of commander) for (const col of c.colorIdentity) identity.add(col)

  return {
    name: opts.name,
    importedAt: new Date().toISOString(),
    sourceFile: opts.sourceFile,
    commander,
    main,
    reserve,
    unresolved,
    foils,
    colorIdentity: [...identity]
  }
}
