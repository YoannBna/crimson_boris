import type { Card, Printing } from '@shared/mtg'
import { RequestQueue } from './http'

/*
 * Client Scryfall.
 *
 * Contraintes imposees par leur politique d'acces :
 *   - 50 a 100 ms entre deux appels ; la file en impose 120
 *   - User-Agent et Accept explicites, obligatoires
 *   - toute reponse doit etre mise en cache cote client
 *
 * Le cache vit dans SQLite (voir store/cards.ts) ; cette couche-ci ne
 * fait que parler au reseau.
 */

const BASE = 'https://api.scryfall.com'
const UA = 'CrimsonBoris/2.0 (application de bureau personnelle)'

const queue = new RequestQueue(120, UA)

interface ScryPrices {
  eur?: string | null
  usd?: string | null
}

interface ScryCard {
  id: string
  oracle_id?: string
  name: string
  mana_cost?: string
  cmc?: number
  type_line?: string
  oracle_text?: string
  colors?: string[]
  color_identity?: string[]
  power?: string
  toughness?: string
  layout?: string
  set?: string
  set_name?: string
  collector_number?: string
  artist?: string
  prices?: ScryPrices
  image_uris?: { small?: string; normal?: string }
  card_faces?: {
    mana_cost?: string
    type_line?: string
    oracle_text?: string
    image_uris?: { small?: string; normal?: string }
  }[]
  full_art?: boolean
  border_color?: string
  frame_effects?: string[]
  promo?: boolean
  textless?: boolean
}

interface ScryList<T> {
  data?: T[]
  has_more?: boolean
  next_page?: string
  total_cards?: number
}

/* ============================================================
   Resolution d'un nom exact
   ============================================================ */

export async function cardByName(name: string): Promise<Card> {
  const url = `${BASE}/cards/named?exact=${encodeURIComponent(name)}`
  return toCard(await queue.getJson<ScryCard>(url))
}

/**
 * Resolution en lot — jusqu'a 75 identifiants par appel.
 * Une seule requete au lieu de 75 : c'est la difference entre
 * neuf secondes et un dixieme pour un deck de commander.
 */
export async function collection(names: string[]): Promise<{
  found: Card[]
  missing: string[]
}> {
  const found: Card[] = []
  const missing: string[] = []

  for (let i = 0; i < names.length; i += 75) {
    const chunk = names.slice(i, i + 75)
    const body = { identifiers: chunk.map((n) => ({ name: n })) }

    const res = await queue.enqueue(async () => {
      const r = await fetchJson(`${BASE}/cards/collection`, body)
      return r as ScryList<ScryCard> & { not_found?: { name?: string }[] }
    })

    for (const c of res.data ?? []) found.push(toCard(c))
    for (const nf of res.not_found ?? []) if (nf.name) missing.push(nf.name)
  }

  return { found, missing }
}

async function fetchJson(url: string, body: unknown): Promise<unknown> {
  const { net } = await import('electron')
  const res = await net.fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`)
  return res.json()
}

/* ============================================================
   Recherche
   ============================================================ */

/** Recherche generique. `limit` borne le nombre de pages parcourues. */
export async function search(query: string, opts: {
  order?: string
  dir?: 'asc' | 'desc'
  unique?: 'cards' | 'prints' | 'art'
  limit?: number
} = {}): Promise<Card[]> {
  const params = new URLSearchParams({ q: query })
  if (opts.order) params.set('order', opts.order)
  if (opts.dir) params.set('dir', opts.dir)
  if (opts.unique) params.set('unique', opts.unique)

  const out: Card[] = []
  let url = `${BASE}/cards/search?${params.toString()}`
  const maxPages = opts.limit ?? 1

  for (let page = 0; page < maxPages && url; page++) {
    let res: ScryList<ScryCard>
    try {
      res = await queue.getJson<ScryList<ScryCard>>(url)
    } catch (err) {
      // Scryfall renvoie 404 quand une recherche ne trouve rien :
      // ce n'est pas une panne, c'est un resultat vide.
      if (err instanceof Error && err.message.includes('HTTP 404')) break
      throw err
    }
    for (const c of res.data ?? []) out.push(toCard(c))
    url = res.has_more && res.next_page ? res.next_page : ''
  }

  return out
}

/* ============================================================
   Impressions alternatives
   ============================================================ */

/**
 * Toutes les impressions d'une carte, triees par prix croissant.
 * Le tri se fait sur l'euro : la reference de marche pertinente ici
 * est Cardmarket, pas TCGPlayer.
 */
export async function printings(name: string): Promise<Printing[]> {
  const q = `!"${name.replace(/"/g, '')}"`
  const params = new URLSearchParams({
    q,
    unique: 'prints',
    order: 'eur',
    dir: 'asc'
  })

  let raw: ScryList<ScryCard>
  try {
    raw = await queue.getJson<ScryList<ScryCard>>(`${BASE}/cards/search?${params}`)
  } catch (err) {
    if (err instanceof Error && err.message.includes('HTTP 404')) return []
    throw err
  }

  return (raw.data ?? []).map(toPrinting)
}

function toPrinting(c: ScryCard): Printing {
  const face = c.image_uris ? c : c.card_faces?.[0]
  const fx = c.frame_effects ?? []

  /*
   * Note esthetique. Scryfall ne publie aucun indicateur de « style » :
   * il faut le deduire des attributs d'impression. Les traitements les
   * plus recherches sont, dans l'ordre, le sans-bordure, l'illustration
   * pleine page et les cadres vitrine.
   */
  let style = 0
  if (c.border_color === 'borderless') style += 40
  if (c.full_art) style += 30
  if (fx.includes('showcase')) style += 25
  if (fx.includes('extendedart')) style += 18
  if (fx.includes('etched')) style += 15
  if (c.textless) style += 12
  if (fx.includes('inverted') || fx.includes('shatteredglass')) style += 10
  if (c.promo) style += 5

  return {
    scryfallId: c.id,
    name: c.name,
    setCode: (c.set ?? '').toUpperCase(),
    setName: c.set_name ?? '',
    collectorNumber: c.collector_number ?? '',
    artist: c.artist ?? null,
    priceEur: numOrNull(c.prices?.eur),
    priceUsd: numOrNull(c.prices?.usd),
    imageNormal: face?.image_uris?.normal ?? null,
    fullArt: c.full_art === true,
    borderColor: c.border_color ?? 'black',
    frameEffects: fx,
    promo: c.promo === true,
    styleScore: Math.min(100, style)
  }
}

/* ============================================================
   Conversion
   ============================================================ */

export function toCard(c: ScryCard): Card {
  const face = c.image_uris ? c : c.card_faces?.[0]

  /*
   * Sur une carte a plusieurs faces, Scryfall renvoie souvent une chaine
   * VIDE a la racine plutot qu'un champ absent : le texte n'existe que
   * dans `card_faces`. Un `??` ne suffit donc pas — il faut tester le
   * contenu, sans quoi la carte est classee sur un texte vide et perd
   * toutes ses categories.
   */
  const textParts = [c.oracle_text ?? '', ...(c.card_faces?.map((f) => f.oracle_text ?? '') ?? [])]
  const oracleText = [...new Set(textParts.filter((t) => t.trim() !== ''))].join('\n')
  const typeLine =
    c.type_line && c.type_line.trim() !== ''
      ? c.type_line
      : (c.card_faces?.[0]?.type_line ?? '')

  const produces = manaProduced(oracleText, typeLine)
  const roles = classify(typeLine, oracleText)

  /*
   * Toute source de mana non-terrain est de la rampe, quelle que soit la
   * formulation de son texte. La detection par mots-cles ne suffit pas :
   * « Add one mana of any color » ne contient aucun symbole entre accolades,
   * et les Signets comme les Talismans y echappaient.
   */
  if (produces.length > 0 && !roles.includes('land') && !roles.includes('ramp')) {
    roles.push('ramp')
  }

  return {
    oracleId: c.oracle_id ?? c.id,
    scryfallId: c.id,
    name: c.name,
    manaCost: c.mana_cost ?? c.card_faces?.[0]?.mana_cost ?? null,
    cmc: c.cmc ?? 0,
    typeLine,
    oracleText,
    colors: c.colors ?? [],
    colorIdentity: c.color_identity ?? [],
    power: c.power ?? null,
    toughness: c.toughness ?? null,
    producesMana: produces,
    imageSmall: face?.image_uris?.small ?? null,
    imageNormal: face?.image_uris?.normal ?? null,
    priceEur: numOrNull(c.prices?.eur),
    priceUsd: numOrNull(c.prices?.usd),
    roles,
    layout: c.layout ?? 'normal',
    setCode: (c.set ?? '').toUpperCase(),
    collectorNumber: c.collector_number ?? ''
  }
}

function numOrNull(v: string | null | undefined): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Couleurs que la carte sait produire, deduites du texte oracle. */
export function manaProduced(oracle: string, typeLine: string): string[] {
  const out = new Set<string>()
  if (/\bBasic Land\b/i.test(typeLine)) {
    if (/Plains/i.test(typeLine)) out.add('W')
    if (/Island/i.test(typeLine)) out.add('U')
    if (/Swamp/i.test(typeLine)) out.add('B')
    if (/Mountain/i.test(typeLine)) out.add('R')
    if (/Forest/i.test(typeLine)) out.add('G')
    if (/Wastes/i.test(typeLine)) out.add('C')
    if (out.size > 0) return [...out]
  }
  for (const m of oracle.matchAll(/Add ([^.]*)/gi)) {
    const seg = m[1]
    if (/one mana of any color|any color/i.test(seg)) return ['W', 'U', 'B', 'R', 'G']
    for (const sym of seg.matchAll(/\{([WUBRGC])\}/g)) out.add(sym[1])
  }
  return [...out]
}

/**
 * Classement fonctionnel par lecture du texte oracle.
 *
 * C'est une heuristique, pas une verite : elle est calibree pour les
 * archetypes aristocrates et tribal, et se trompera sur les cartes a
 * effet indirect. Elle sert a mesurer des tendances sur des centaines
 * de parties, pas a arbitrer une carte isolee.
 */
export function classify(typeLine: string, oracle: string): Card['roles'] {
  const roles = new Set<Card['roles'][number]>()
  const t = typeLine.toLowerCase()

  if (t.includes('land')) roles.add('land')
  if (t.includes('creature')) roles.add('creature')

  if (
    /add \{|search your library for a[n]? .*land|create a treasure/i.test(oracle) &&
    !t.includes('land')
  ) {
    roles.add('ramp')
  }

  // « draws » avec un s : « target player draws two cards ». Sans le
  // quantificateur optionnel, toute une famille d'effets echappe au classement.
  if (/draws? (a|two|three|\w+) cards?/i.test(oracle) && !/opponent draws/i.test(oracle)) {
    roles.add('draw')
  }

  if (/destroy all|exile all|each creature gets -|destroy each/i.test(oracle)) roles.add('wrath')
  else if (
    /destroy target|target creature gets -|fights|deals \d+ damage to target/i.test(oracle) ||
    // Restreint aux cibles qui sont des permanents : « exile target player's
    // graveyard » est du pillage de cimetiere, pas une reponse a une menace.
    /exile target (creature|permanent|artifact|enchantment|planeswalker|nonland|attacking|blocking)/i.test(
      oracle
    )
  ) {
    roles.add('removal')
  }

  /*
   * Deux familles d'interaction que la formule « destroy target » ne
   * couvre pas, et qui sont pourtant du removal a part entiere :
   *   - l'edit : le sacrifice force (Anowon, Blasphemous Edict)
   *   - l'appropriation : le vol de creature (New Blood)
   */
  if (/each (player|opponent)[^.]*sacrifices/i.test(oracle)) roles.add('removal')
  if (/gain control of target/i.test(oracle)) roles.add('removal')

  // Un exutoire libre n'exige aucun cout de mana pour sacrifier.
  if (/sacrifice (a|another|an) creature:/i.test(oracle)) roles.add('sacrifice-outlet')

  if (/create .*token/i.test(oracle)) roles.add('token-maker')

  if (/loses? \d+ life .*gains? \d+ life|each opponent loses \d+ life/i.test(oracle)) {
    roles.add('drain')
  }

  if (/creatures you control get \+/i.test(oracle)) roles.add('anthem')

  if (/return .*from your graveyard to (the battlefield|your hand)/i.test(oracle)) {
    roles.add('recursion')
  }

  if (/hexproof|indestructible|protection from|ward/i.test(oracle)) roles.add('protection')

  if (roles.size === 0) roles.add('other')
  return [...roles]
}
