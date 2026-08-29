import type { Card, ParseResult, ResolvedDeck } from '@shared/mtg'
import { collection } from '../providers/scryfall'
import { getCached, keysFor, nameKey, putCards } from '../store/cards'

/*
 * Etiquettes de structure : elles disent OU va la carte, pas CE QU'ELLE
 * EST. Sans ce tri, « Commander », « noDeck » ou « foil » remonteraient
 * comme des categories de rangement a cote de « Vampires » et « Rampe ».
 */
const STRUCTURAL = new Set([
  'commander',
  'commandant',
  'nodeck',
  'noprice',
  'top',
  'foil',
  'maybeboard',
  'maybe',
  'sideboard',
  'side',
  'excluded'
])

export function categoriesOf(tags: string[]): string[] {
  const out: string[] = []
  for (const t of tags) {
    const clean = t.trim()
    if (clean === '' || STRUCTURAL.has(clean.toLowerCase())) continue
    if (!out.includes(clean)) out.push(clean)
  }
  return out
}

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
  // Indexees sur le nom RESOLU, pas sur celui de l'export : une carte
  // recto-verso n'y porte pas le meme nom, et l'interface cherche par
  // le nom qu'elle affiche.
  const categories: Record<string, string[]> = {}

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

    const cats = categoriesOf(line.tags)
    if (cats.length > 0) categories[card.name] = cats
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
    colorIdentity: [...identity],
    categories
  }
}
