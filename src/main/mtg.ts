import { mkdir, readdir, readFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { app } from 'electron'
import type { ResolvedDeck, SimConfig, SimResult } from '@shared/mtg'
import { parseDeck } from './deck/parse'
import { resolveDeck } from './deck/resolve'
import { simulate } from './sim/engine'
import { analyze } from './sim/analyze'
import { latestDeck, latestRun, saveDeck, saveRun } from './store/decks'

/**
 * Dossier d'accueil des exports.
 * En developpement il vit a la racine du projet ; une fois l'application
 * empaquetee, il n'y a plus de racine de projet — il passe dans userData.
 * L'interface affiche toujours le chemin reel, faute de quoi le bouton
 * « lire le dossier » designerait un endroit invisible.
 */
export function decksDir(): string {
  return app.isPackaged ? join(app.getPath('userData'), 'decks') : join(process.cwd(), 'decks')
}

/** Cree le dossier d'accueil s'il manque, et renvoie son chemin. */
export async function ensureDecksDir(): Promise<string> {
  const dir = decksDir()
  await mkdir(dir, { recursive: true })
  return dir
}

export async function importFromFile(path: string): Promise<ResolvedDeck> {
  const text = await readFile(path, 'utf8')
  const parsed = parseDeck(text)

  if (parsed.lines.length === 0) {
    throw new Error(
      `Aucune carte lisible dans ${basename(path)} — ${parsed.rejected.length} ligne(s) ecartee(s).`
    )
  }

  const deck = await resolveDeck(parsed, {
    name: basename(path, extname(path)),
    sourceFile: path
  })
  saveDeck(deck)
  return deck
}

/** Importe le premier export trouve dans le dossier d'accueil. */
export async function importFromFolder(): Promise<ResolvedDeck | null> {
  const dir = await ensureDecksDir()
  let names: string[]
  try {
    names = await readdir(dir)
  } catch {
    return null
  }
  const candidate = names
    .filter((n) => /\.(txt|dec)$/i.test(n))
    .sort()
    .at(0)
  if (!candidate) return null
  return importFromFile(join(dir, candidate))
}

export function currentDeck(): ResolvedDeck | null {
  return latestDeck()
}

export const DEFAULT_SIM: SimConfig = {
  opponents: 3,
  games: 400,
  maxTurns: 12,
  seed: 20260821
}

export function runSimulation(partial: Partial<SimConfig> = {}): SimResult {
  const deck = latestDeck()
  if (!deck) throw new Error('Aucun deck importe. Depose un export dans le dossier decks/.')
  if (deck.main.length < 20) {
    throw new Error(
      `Deck trop court pour etre simule : ${deck.main.length} carte(s) resolues en deck principal.`
    )
  }

  const config: SimConfig = { ...DEFAULT_SIM, ...partial }
  const games = simulate(deck, config)
  const findings = analyze(games, deck)

  const result: SimResult = {
    runAt: new Date().toISOString(),
    config,
    deckName: deck.name,
    games,
    findings
  }
  saveRun(result)
  return result
}

export function lastRun(): SimResult | null {
  return latestRun()
}
