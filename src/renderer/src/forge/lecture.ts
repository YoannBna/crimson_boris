import type { Card, GameRecord, ResolvedDeck, SimResult } from '@shared/mtg'

/* ============================================================
   Lecture du deck
   Tout ce qui se deduit de la liste seule, sans reseau ni partie.
   ============================================================ */

export interface Exemplaire {
  card: Card
  /** Nombre d'exemplaires dans la liste */
  n: number
}

export interface Groupe {
  key: string
  label: string
  cards: Exemplaire[]
  /** Exemplaires cumules, pas cartes distinctes */
  total: number
}

const ROLE_FR: Record<string, string> = {
  land: 'Terrains',
  ramp: 'Rampe',
  draw: 'Pioche',
  removal: 'Removal',
  wrath: 'Balayages',
  'sacrifice-outlet': 'Exutoires',
  'token-maker': 'Jetons',
  drain: 'Drain',
  anthem: 'Anthems',
  recursion: 'Recursion',
  protection: 'Protection',
  creature: 'Creatures',
  other: 'Autres'
}

/**
 * Un role de repli, quand l'export ne porte pas de categorie.
 * L'ordre compte : `roles` peut en contenir plusieurs, et « Terrains »
 * doit gagner sur tout le reste — une carte qui produit du mana et
 * pioche reste d'abord un terrain aux yeux du rangement.
 */
const PRIORITE: string[] = [
  'land',
  'wrath',
  'removal',
  'draw',
  'ramp',
  'sacrifice-outlet',
  'recursion',
  'drain',
  'token-maker',
  'anthem',
  'protection',
  'creature',
  'other'
]

function roleLabel(card: Card): string {
  for (const r of PRIORITE) if (card.roles.includes(r as Card['roles'][number])) return ROLE_FR[r]
  return ROLE_FR.other
}

/** Regroupe les exemplaires par nom, en conservant l'ordre de la liste. */
export function parNom(cards: Card[]): Exemplaire[] {
  const out = new Map<string, Exemplaire>()
  for (const c of cards) {
    const e = out.get(c.name)
    if (e) e.n += 1
    else out.set(c.name, { card: c, n: 1 })
  }
  return [...out.values()]
}

export interface Rangement {
  groupes: Groupe[]
  /** D'ou vient le classement — l'interface le dit plutot que de le laisser deviner */
  source: 'archidekt' | 'roles'
}

/**
 * Classe le deck par categories Archidekt quand l'export en portait,
 * par roles deduits sinon.
 *
 * Une carte peut appartenir a plusieurs categories dans Archidekt ; on
 * ne retient que la premiere. La compter deux fois ferait un deck de
 * 130 cartes a l'ecran, ce qui est pire que perdre une etiquette.
 */
export function ranger(deck: ResolvedDeck): Rangement {
  const cats = deck.categories ?? {}
  const source = Object.keys(cats).length > 0 ? 'archidekt' : 'roles'
  const groupes = new Map<string, Groupe>()

  const verser = (label: string, e: Exemplaire): void => {
    const key = label.toLowerCase()
    const g = groupes.get(key) ?? { key, label, cards: [], total: 0 }
    g.cards.push(e)
    g.total += e.n
    groupes.set(key, g)
  }

  for (const e of parNom(deck.main)) {
    const known = cats[e.card.name]?.[0]
    verser(known ?? roleLabel(e.card), e)
  }

  const liste = [...groupes.values()]
  for (const g of liste) g.cards.sort(triCarte)

  // Les terrains ferment la marche : c'est la partie de la liste qu'on
  // consulte le moins, et elle est la plus longue.
  liste.sort((a, b) => {
    const ta = terrain(a) ? 1 : 0
    const tb = terrain(b) ? 1 : 0
    if (ta !== tb) return ta - tb
    return b.total - a.total
  })

  const commandant = parNom(deck.commander)
  if (commandant.length > 0) {
    liste.unshift({
      key: '@commandant',
      label: 'Commandant',
      cards: commandant,
      total: commandant.reduce((n, e) => n + e.n, 0)
    })
  }

  return { groupes: liste, source }
}

function terrain(g: Groupe): boolean {
  return /terrain|land/i.test(g.label)
}

/** Cout croissant, puis alphabetique : c'est l'ordre ou l'on cherche une carte. */
function triCarte(a: Exemplaire, b: Exemplaire): number {
  if (a.card.cmc !== b.card.cmc) return a.card.cmc - b.card.cmc
  return a.card.name.localeCompare(b.card.name, 'fr')
}

/* ============================================================
   Statistiques
   ============================================================ */

export interface Stats {
  total: number
  terrains: number
  sorts: number
  /** Cout converti moyen, terrains exclus */
  cmcMoyen: number
  /** Valeur marchande de la liste, exemplaires compris */
  prix: number
  /** Cartes sans prix connu — le total serait trompeur sans ce compte */
  prixInconnus: number
  identite: string[]
  /** Nombre de sorts par cout converti, 0 a 7+ */
  courbe: number[]
  roles: { role: string; label: string; n: number }[]
}

export function statistiques(deck: ResolvedDeck): Stats {
  const toutes = [...deck.commander, ...deck.main]
  const sorts = deck.main.filter((c) => !c.roles.includes('land'))

  const courbe = new Array<number>(8).fill(0)
  for (const c of sorts) courbe[Math.min(7, Math.floor(c.cmc))] += 1

  let prix = 0
  let prixInconnus = 0
  for (const c of toutes) {
    if (c.priceEur === null) prixInconnus += 1
    else prix += c.priceEur
  }

  const compte = new Map<string, number>()
  for (const c of deck.main) for (const r of c.roles) compte.set(r, (compte.get(r) ?? 0) + 1)

  return {
    total: toutes.length,
    terrains: deck.main.length - sorts.length,
    sorts: sorts.length,
    cmcMoyen: sorts.length === 0 ? 0 : sorts.reduce((n, c) => n + c.cmc, 0) / sorts.length,
    prix,
    prixInconnus,
    identite: deck.colorIdentity,
    courbe,
    roles: [...compte.entries()]
      .map(([role, n]) => ({ role, label: ROLE_FR[role] ?? role, n }))
      .sort((a, b) => b.n - a.n)
  }
}

/* ============================================================
   Forces
   ============================================================ */

/**
 * Le volet Analyse doit montrer les forces autant que les defauts, et
 * le moteur ne remonte que ce qui cloche. Les seuils sont ceux de
 * `recommend.ts` : au-dessus, c'est une force ; en dessous, le moteur
 * a deja produit son constat. Les deux ne peuvent pas se contredire.
 */
export interface Force {
  label: string
  measure: string
}

const SEUILS: { role: string; label: string; min: number; lecture: string }[] = [
  { role: 'draw', label: 'Pioche', min: 10, lecture: 'la main se renouvelle apres deploiement' },
  { role: 'removal', label: 'Removal', min: 8, lecture: 'de quoi repondre aux menaces adverses' },
  { role: 'ramp', label: 'Rampe', min: 8, lecture: 'la courbe tient sur trois couleurs' },
  { role: 'sacrifice-outlet', label: 'Exutoires', min: 3, lecture: 'les jetons se convertissent' }
]

export function forces(deck: ResolvedDeck, run: SimResult | null): Force[] {
  const out: Force[] = []
  const s = statistiques(deck)

  if (s.total === 100) {
    out.push({ label: 'Format respecte', measure: '100 cartes, commandant compris.' })
  }
  if (s.identite.length > 0) {
    const permis = new Set(s.identite)
    const hors = deck.main.filter((c) => c.colorIdentity.some((col) => !permis.has(col)))
    if (hors.length === 0) {
      out.push({
        label: 'Identite couleur tenue',
        measure: `Aucune carte hors ${s.identite.join('')}.`
      })
    }
  }
  if (s.terrains >= 34) {
    out.push({
      label: 'Base de mana fournie',
      measure: `${s.terrains} terrains — au-dessus du plancher de 34 pour un deck a trois couleurs.`
    })
  }
  if (s.cmcMoyen > 0 && s.cmcMoyen <= 3.2) {
    out.push({
      label: 'Courbe basse',
      measure: `Cout moyen de ${s.cmcMoyen.toFixed(2)} hors terrains : le deck se deploie tot.`
    })
  }

  const compte = new Map<string, number>()
  for (const c of deck.main) for (const r of c.roles) compte.set(r, (compte.get(r) ?? 0) + 1)
  for (const t of SEUILS) {
    const n = compte.get(t.role) ?? 0
    if (n >= t.min) {
      out.push({ label: `${t.label} suffisante`, measure: `${n} cartes (seuil ${t.min}) — ${t.lecture}.` })
    }
  }

  // Le banc d'essai qualifie « nominal » ce qui a tenu en partie : c'est
  // une force mesuree, pas deduite. Elle vaut plus que les precedentes.
  if (run) {
    for (const f of run.findings.filter((x) => x.grade === 'nominal')) {
      out.push({ label: f.title, measure: f.measure })
    }
  }

  return out
}

/* ============================================================
   Agregats de campagne
   ============================================================ */

export interface Agregats {
  parties: number
  mulligansMoyen: number
  terrainsOuverture: number
  /** Tour ou le troisieme terrain arrive, en moyenne */
  troisiemeTerrain: number | null
  manaGaspille: number
  /** Poses de terrain manquees par partie, en moyenne */
  posesManquees: number
  premierPioche: number | null
  sansPioche: number
  premiereInteraction: number | null
  sansInteraction: number
  cartesCoincees: number
  /** Terrains en jeu au tour N, moyenne, index 0 = tour 1 */
  terrainsParTour: number[]
}

export function agreger(run: SimResult): Agregats {
  const g = run.games
  const n = g.length || 1

  const moyenne = (f: (x: GameRecord) => number): number => g.reduce((s, x) => s + f(x), 0) / n

  const defini = (f: (x: GameRecord) => number | null): { moy: number | null; manquants: number } => {
    const vals = g.map(f).filter((v): v is number => v !== null)
    return {
      moy: vals.length === 0 ? null : vals.reduce((s, v) => s + v, 0) / vals.length,
      manquants: (g.length - vals.length) / n
    }
  }

  const pioche = defini((x) => x.firstDrawSpellTurn)
  const interaction = defini((x) => x.firstInteractionTurn)

  const troisieme = g.map((x) => x.landCurve[2]).filter((v): v is number => v !== undefined)

  const maxTours = run.config.maxTurns
  const terrainsParTour: number[] = []
  for (let t = 0; t < maxTours; t++) {
    const vus = g.map((x) => x.turns[t]?.landsInPlay).filter((v): v is number => v !== undefined)
    if (vus.length === 0) break
    terrainsParTour.push(vus.reduce((s, v) => s + v, 0) / vus.length)
  }

  return {
    parties: g.length,
    mulligansMoyen: moyenne((x) => x.mulligans),
    terrainsOuverture: moyenne((x) => x.openingLands),
    troisiemeTerrain:
      troisieme.length === 0 ? null : troisieme.reduce((s, v) => s + v, 0) / troisieme.length,
    manaGaspille: moyenne((x) => x.turns.reduce((s, t) => s + t.manaWasted, 0)),
    // Compte les tours, pas les parties : sur douze tours, presque
    // toutes les parties en manquent au moins un et la proportion vaut
    // toujours 100 %. La moyenne, elle, distingue une base de mana
    // solide d'une base qui decroche.
    posesManquees: moyenne((x) => x.turns.filter((t) => t.landDrop).length),
    premierPioche: pioche.moy,
    sansPioche: pioche.manquants,
    premiereInteraction: interaction.moy,
    sansInteraction: interaction.manquants,
    cartesCoincees: moyenne((x) => x.stuckInHand.length),
    terrainsParTour
  }
}
