import type { Card, ResolvedDeck, SimResult } from '@shared/mtg'
import type { Change, Directive, DirectiveTarget } from '@shared/forge'
import { search } from '../providers/scryfall'
import { putCards } from '../store/cards'

/*
 * Traduit une directive comprise en modifications concretes.
 *
 * Les ajouts partent chercher des candidats reels sur Scryfall, filtres
 * sur l'identite couleur du commandant. Les coupes se choisissent dans
 * le deck, en s'appuyant sur les mesures de la derniere campagne quand
 * elles existent : une carte que la simulation voit dormir en main est
 * une meilleure candidate qu'une carte choisie au hasard.
 */

/** Fragment de requete Scryfall par categorie fonctionnelle. */
const QUERY: Record<DirectiveTarget, string> = {
  pioche: '(o:"draw a card" or o:"draw two cards" or o:"draw three cards") -t:land',
  removal: '(o:"destroy target" or o:"exile target creature") -t:land',
  wrath: '(o:"destroy all" or o:"each player sacrifices")',
  ramp: '(o:"add {" or o:"search your library for a" o:land) -t:land',
  exutoire: 'o:"sacrifice a creature:"',
  drain: '(o:"loses life" o:"you gain" or o:"each opponent loses")',
  jetons: 'o:"create" o:"token"',
  anthem: 'o:"creatures you control get +"',
  recursion: 'o:"return target creature card from your graveyard"',
  protection: '(o:hexproof or o:indestructible or o:"protection from")',
  terrain: 't:land',
  creature: 't:creature'
}

const TARGET_ROLE: Record<DirectiveTarget, string> = {
  pioche: 'draw',
  removal: 'removal',
  wrath: 'wrath',
  ramp: 'ramp',
  exutoire: 'sacrifice-outlet',
  drain: 'drain',
  jetons: 'token-maker',
  anthem: 'anthem',
  recursion: 'recursion',
  protection: 'protection',
  terrain: 'land',
  creature: 'creature'
}

export interface ExecContext {
  deck: ResolvedDeck
  /** Derniere campagne, quand elle existe : sert a choisir les coupes */
  run: SimResult | null
}

export async function execute(
  directive: Directive,
  ctx: ExecContext
): Promise<{ changes: Change[]; report: string }> {
  if (directive.verb === 'ajoute') return addFrom(directive, ctx)
  if (directive.verb === 'coupe') return cutFrom(directive, ctx)
  return replaceFrom(directive, ctx)
}

/* ============================================================
   Ajout
   ============================================================ */

async function addFrom(
  d: Directive,
  ctx: ExecContext
): Promise<{ changes: Change[]; report: string }> {
  const query = buildQuery(d, ctx.deck)
  let found: Card[]
  try {
    found = await search(query, { order: 'edhrec', unique: 'cards', limit: 1 })
  } catch (err) {
    return {
      changes: [],
      report: `« ${d.raw} » — interrogation de Scryfall en echec : ${
        err instanceof Error ? err.message : String(err)
      }`
    }
  }
  putCards(found)

  const owned = new Set(
    [...ctx.deck.commander, ...ctx.deck.main, ...ctx.deck.reserve].map((c) =>
      c.name.toLowerCase()
    )
  )
  const picks = found.filter((c) => !owned.has(c.name.toLowerCase())).slice(0, d.quantity)

  if (picks.length === 0) {
    return { changes: [], report: `« ${d.raw} » — aucun candidat hors du deck pour : ${query}` }
  }

  const changes = picks.map<Change>((card) => ({
    id: `add-${card.oracleId}`,
    kind: 'add',
    cardName: card.name,
    card,
    because: describe(d),
    source: 'directive'
  }))

  const short = picks.length < d.quantity ? ` (${picks.length} sur ${d.quantity} demandes)` : ''
  return {
    changes,
    report: `« ${d.raw} » → ${picks.map((c) => c.name).join(', ')}${short}`
  }
}

function buildQuery(d: Directive, deck: ResolvedDeck): string {
  const parts: string[] = ['f:commander']

  if (deck.colorIdentity.length > 0) {
    parts.push(`id<=${deck.colorIdentity.join('').toLowerCase()}`)
  }
  if (d.target) parts.push(QUERY[d.target])
  if (d.constraints.color) parts.push(`produces:${d.constraints.color.toLowerCase()}`)
  if (d.constraints.maxCmc !== undefined) parts.push(`cmc<=${d.constraints.maxCmc}`)
  if (d.constraints.maxPrice !== undefined) parts.push(`eur<${d.constraints.maxPrice}`)
  if (d.constraints.entersTapped === false) parts.push('-o:"enters tapped"')
  if (d.constraints.entersTapped === true) parts.push('o:"enters tapped"')

  // Une demande de sources de couleur sans categorie vise les terrains.
  if (!d.target && d.constraints.color) parts.push('t:land')

  return parts.join(' ')
}

/* ============================================================
   Coupe
   ============================================================ */

function cutFrom(d: Directive, ctx: ExecContext): { changes: Change[]; report: string } {
  const pool = dedupe(ctx.deck.main)

  /* --- coupe par nom explicite -------------------------- */
  if (d.cardName) {
    const hit = pool.find((c) => c.name.toLowerCase().includes(d.cardName!.toLowerCase()))
    if (!hit) {
      return { changes: [], report: `« ${d.raw} » — « ${d.cardName} » absente du deck principal` }
    }
    return {
      changes: [cut(hit, `retrait demande nommement`)],
      report: `« ${d.raw} » → ${hit.name}`
    }
  }

  /* --- coupe des cartes qui dorment --------------------- */
  if (d.dormant) {
    const ranked = dormantRanking(ctx)
    if (ranked.length === 0) {
      return {
        changes: [],
        report: `« ${d.raw} » — aucune campagne disponible : lance le banc d'essai d'abord`
      }
    }
    const picks = ranked.slice(0, d.quantity)
    return {
      changes: picks.map((p) =>
        cut(p.card, `restee en main dans ${p.pct.toFixed(0)} % des parties simulees`)
      ),
      report: `« ${d.raw} » → ${picks.map((p) => `${p.card.name} (${p.pct.toFixed(0)} %)`).join(', ')}`
    }
  }

  /* --- coupe par categorie ------------------------------ */
  if (d.target) {
    const role = TARGET_ROLE[d.target]
    let candidates = pool.filter((c) => c.roles.includes(role as Card['roles'][number]))

    if (d.constraints.entersTapped === true) {
      candidates = candidates.filter((c) => /enters tapped/i.test(c.oracleText))
    }
    if (d.constraints.maxCmc !== undefined) {
      candidates = candidates.filter((c) => c.cmc <= d.constraints.maxCmc!)
    }
    if (candidates.length === 0) {
      return { changes: [], report: `« ${d.raw} » — aucune carte du deck ne repond a ce critere` }
    }

    // A defaut d'autre critere, on coupe le plus cher en mana : c'est la
    // carte la plus difficile a lancer, donc la moins souvent utile.
    const picks = [...candidates].sort((a, b) => b.cmc - a.cmc).slice(0, d.quantity)
    return {
      changes: picks.map((c) => cut(c, describe(d))),
      report: `« ${d.raw} » → ${picks.map((c) => c.name).join(', ')}`
    }
  }

  return { changes: [], report: `« ${d.raw} » — critere de coupe indetermine` }
}

/* ============================================================
   Remplacement
   ============================================================ */

async function replaceFrom(
  d: Directive,
  ctx: ExecContext
): Promise<{ changes: Change[]; report: string }> {
  const out = cutFrom({ ...d, verb: 'coupe' }, ctx)
  if (out.changes.length === 0) return out

  const inbound = await addFrom(
    {
      ...d,
      verb: 'ajoute',
      quantity: 1,
      target: d.replacement?.target,
      cardName: undefined
    },
    ctx
  )

  return {
    changes: [...out.changes, ...inbound.changes],
    report: `« ${d.raw} » → sort ${out.changes[0].cardName}${
      inbound.changes.length > 0 ? `, entre ${inbound.changes[0].cardName}` : ' — aucun remplacant trouve'
    }`
  }
}

/* ============================================================
   Outils
   ============================================================ */

/** Classement des cartes du deck par frequence de blocage en main. */
export function dormantRanking(ctx: ExecContext): { card: Card; pct: number }[] {
  if (!ctx.run) return []

  const counts = new Map<string, number>()
  for (const g of ctx.run.games) {
    for (const name of new Set(g.stuckInHand)) {
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
  }

  const byName = new Map(dedupe(ctx.deck.main).map((c) => [c.name, c]))
  return [...counts.entries()]
    .map(([name, n]) => ({ card: byName.get(name), pct: (n / ctx.run!.games.length) * 100 }))
    .filter((x): x is { card: Card; pct: number } => x.card !== undefined)
    .sort((a, b) => b.pct - a.pct)
}

function cut(card: Card, because: string): Change {
  return { id: `cut-${card.oracleId}`, kind: 'cut', cardName: card.name, card, because, source: 'directive' }
}

function dedupe(cards: Card[]): Card[] {
  const seen = new Map<string, Card>()
  for (const c of cards) if (!seen.has(c.name)) seen.set(c.name, c)
  return [...seen.values()]
}

function describe(d: Directive): string {
  const bits: string[] = []
  if (d.target) bits.push(d.target)
  if (d.constraints.maxCmc !== undefined) bits.push(`cmc ≤ ${d.constraints.maxCmc}`)
  if (d.constraints.maxPrice !== undefined) bits.push(`< ${d.constraints.maxPrice} €`)
  if (d.constraints.color) bits.push(`source ${d.constraints.color}`)
  if (d.constraints.entersTapped === false) bits.push('entre degage')
  if (d.constraints.entersTapped === true) bits.push('entre engage')
  return `directive : ${bits.join(', ') || 'sans critere'}`
}
