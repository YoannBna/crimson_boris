import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Change, DirectivePlan, PoolQuery, PoolResult, Workbench } from '@shared/forge'
import type { ResolvedDeck } from '@shared/mtg'
import { search } from '../providers/scryfall'
import { putCards } from '../store/cards'
import { parseDirectives } from './directives'
import { execute, type ExecContext } from './execute'

/*
 * Etabli : les modifications en attente.
 *
 * Rien n'ecrase jamais l'export d'origine. Le plan se construit, se
 * defait, et ne sort de l'atelier que sous la forme d'un NOUVEAU fichier.
 * Un assistant de composition qui modifie la liste sous les doigts de son
 * operateur est un assistant dont on se mefie.
 */

let changes: Change[] = []

export function currentChanges(): Change[] {
  return changes
}

export function snapshot(deck: ResolvedDeck | null): Workbench | null {
  if (!deck) return null
  const base = deck.main.length + deck.commander.length
  const delta = changes.reduce((n, c) => n + (c.kind === 'add' ? 1 : -1), 0)
  const projected = base + delta

  return {
    deckName: deck.name,
    baseTotal: base,
    projectedTotal: projected,
    changes,
    verdict: verdictFor(projected)
  }
}

/**
 * Un plan qui laisse le deck hors format n'est pas un plan valide.
 * Le dire est le minimum : c'est la seule contrainte du format qui ne
 * se discute pas.
 */
function verdictFor(total: number): Workbench['verdict'] {
  const delta = total - 100
  if (delta === 0) {
    return { ok: true, delta, message: 'Plan conforme : exactement 100 cartes, commandant compris.' }
  }
  if (delta > 0) {
    return {
      ok: false,
      delta,
      message: `Le plan laisse ${delta} carte(s) de trop. Ajoute autant de coupes avant d'exporter.`
    }
  }
  return {
    ok: false,
    delta,
    message: `Le plan laisse ${-delta} emplacement(s) vide(s). Autant les choisir que les subir.`
  }
}

/**
 * Une carte ne peut apparaitre qu'une fois dans un plan : deux directives
 * peuvent viser la meme cible sans que cela compte double.
 */
function dedupeChanges(list: Change[]): Change[] {
  const byName = new Map<string, Change>()
  for (const c of list) {
    const key = c.cardName.toLowerCase()
    const prev = byName.get(key)
    if (prev && prev.kind === c.kind) {
      // Meme intention deja exprimee : on conserve la premiere justification
      // et on signale qu'elle a ete confirmee.
      byName.set(key, { ...prev, because: `${prev.because} · confirme par une autre directive` })
      continue
    }
    byName.set(key, c)
  }
  return [...byName.values()]
}

export function addChange(change: Omit<Change, 'id'>): void {
  const id = `${change.kind}-${change.cardName.toLowerCase().replace(/\s+/g, '-')}`
  // Une carte ne peut pas etre a la fois ajoutee et retiree : la derniere
  // intention exprimee remplace la precedente.
  changes = changes.filter((c) => c.cardName !== change.cardName)
  changes.push({ ...change, id })
}

export function dropChange(id: string): void {
  changes = changes.filter((c) => c.id !== id)
}

export function clearChanges(): void {
  changes = []
}

/* ============================================================
   Directives
   ============================================================ */

export async function planDirectives(
  text: string,
  ctx: ExecContext
): Promise<DirectivePlan> {
  const { understood, rejected } = parseDirectives(text)
  const produced: Change[] = []
  const report: string[] = []

  for (const d of understood) {
    const out = await execute(d, ctx)
    report.push(out.report)
    for (const c of out.changes) produced.push(c)
  }

  const deduped = dedupeChanges(produced)
  const base = ctx.deck.main.length + ctx.deck.commander.length
  const delta = deduped.reduce((n, c) => n + (c.kind === 'add' ? 1 : -1), 0)

  // Le plan est propose, pas impose : il n'entre a l'etabli que sur
  // validation explicite depuis l'interface.
  return {
    understood,
    rejected,
    changes: deduped,
    report,
    projectedTotal: base + delta
  }
}

/* ============================================================
   Pool global
   ============================================================ */

/**
 * Recherche libre dans le pool Scryfall.
 * La syntaxe Scryfall passe telle quelle ; `legalOnly` ajoute la
 * restriction d'identite couleur du commandant.
 */
export async function searchPool(
  q: PoolQuery,
  deck: ResolvedDeck | null
): Promise<PoolResult> {
  const parts: string[] = []
  const text = q.text.trim()

  if (text === '') return { query: '', scryfall: '', cards: [], truncated: false }
  parts.push(text)

  if (q.legalOnly) {
    parts.push('f:commander')
    if (deck && deck.colorIdentity.length > 0) {
      parts.push(`id<=${deck.colorIdentity.join('').toLowerCase()}`)
    }
  }
  if (q.maxPrice !== undefined) parts.push(`eur<${q.maxPrice}`)

  const scryfall = parts.join(' ')
  const cards = await search(scryfall, { order: 'edhrec', unique: 'cards', limit: 1 })
  putCards(cards)

  return {
    query: text,
    scryfall,
    cards: cards.slice(0, 60),
    truncated: cards.length > 60
  }
}

/* ============================================================
   Export du plan
   ============================================================ */

/**
 * Ecrit la liste modifiee dans un nouveau fichier, au format Archidekt.
 * L'export d'origine reste intact.
 */
export async function exportPlan(
  deck: ResolvedDeck,
  dir: string
): Promise<{ path: string; lines: number }> {
  const cut = new Set(
    changes.filter((c) => c.kind === 'cut').map((c) => c.cardName.toLowerCase())
  )

  const counts = new Map<string, number>()
  for (const c of [...deck.commander, ...deck.main]) {
    if (cut.has(c.name.toLowerCase())) continue
    counts.set(c.name, (counts.get(c.name) ?? 0) + 1)
  }
  for (const c of changes.filter((x) => x.kind === 'add')) {
    counts.set(c.cardName, (counts.get(c.cardName) ?? 0) + 1)
  }

  const commanders = new Set(deck.commander.map((c) => c.name))
  const lines = [...counts.entries()].map(([name, n]) =>
    commanders.has(name) ? `${n}x ${name} [Commander{top}]` : `${n}x ${name}`
  )

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
  const path = join(dir, `${deck.name}-forge-${stamp}.txt`)
  const header = [
    `# ${deck.name} — plan de forge du ${new Date().toLocaleString('fr-FR')}`,
    `# ${changes.filter((c) => c.kind === 'add').length} entrees, ${changes.filter((c) => c.kind === 'cut').length} sorties`,
    `# total : ${lines.reduce((n, l) => n + Number(/^(\d+)x/.exec(l)?.[1] ?? 1), 0)} cartes`,
    ''
  ]

  await writeFile(path, [...header, ...lines.sort()].join('\n') + '\n', 'utf8')
  return { path, lines: lines.length }
}
