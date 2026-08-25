import type { Card, ResolvedDeck, SimResult } from '@shared/mtg'
import type { Advice, AdviceGrade } from '@shared/forge'
import { dormantRanking } from './execute'

/*
 * Analyse statique de la liste.
 *
 * Elle ne joue aucune partie : elle lit la composition telle qu'elle est.
 * C'est le pendant du banc d'essai, qui mesure ce que la liste PRODUIT ;
 * ici on regarde ce qu'elle CONTIENT. Les deux se completent — une liste
 * peut etre irreprochable sur le papier et s'effondrer en jeu, et
 * l'inverse est vrai aussi.
 */

/** Proportions de reference pour un deck de commander agressif et large. */
const TARGETS: { role: string; label: string; min: number; why: string }[] = [
  { role: 'draw', label: 'pioche', min: 10, why: 'renouveler la main apres deploiement' },
  { role: 'removal', label: 'removal', min: 8, why: 'repondre aux menaces adverses' },
  { role: 'ramp', label: 'rampe', min: 8, why: 'tenir la courbe sur trois couleurs' },
  { role: 'sacrifice-outlet', label: 'exutoires', min: 3, why: 'convertir les jetons en degats' }
]

export function advise(deck: ResolvedDeck, run: SimResult | null): Advice[] {
  const out: Advice[] = []
  const unique = dedupe(deck.main)

  out.push(...formatCheck(deck))
  out.push(...offIdentity(deck, unique))
  out.push(...duplicates(deck))
  out.push(...tappedLands(deck))
  out.push(...curveWeight(unique))
  out.push(...thinCategories(unique))
  out.push(...deadWeight(deck, run))

  const weight: Record<AdviceGrade, number> = { critique: 0, important: 1, mineur: 2 }
  return out.sort((a, b) => weight[a.grade] - weight[b.grade])
}

/* --- Legalite ---------------------------------------------- */

function formatCheck(deck: ResolvedDeck): Advice[] {
  const total = deck.main.length + deck.commander.length
  if (total === 100) return []

  const over = total > 100
  return [
    {
      id: 'over-format',
      grade: 'critique',
      title: over ? 'Deck hors format' : 'Deck incomplet',
      measure: `${total} cartes pour une limite de 100, commandant compris — ecart de ${
        over ? '+' : ''
      }${total - 100}.`,
      reading: over
        ? `Le deck n'est pas jouable en l'etat. ${total - 100} coupe(s) a arbitrer avant toute autre optimisation.`
        : `Il manque ${100 - total} carte(s). Autant en faire un choix plutot qu'un oubli.`,
      cards: [],
      proposal: { kind: over ? 'cut' : 'add', quantity: Math.abs(total - 100) }
    }
  ]
}

/* --- Identite couleur -------------------------------------- */

function offIdentity(deck: ResolvedDeck, unique: Card[]): Advice[] {
  if (deck.colorIdentity.length === 0) return []
  const allowed = new Set(deck.colorIdentity)
  const illegal = unique.filter((c) => c.colorIdentity.some((col) => !allowed.has(col)))
  if (illegal.length === 0) return []

  return [
    {
      id: 'off-identity',
      grade: 'critique',
      title: 'Cartes hors identite couleur',
      measure: `${illegal.length} carte(s) portent une couleur absente de l'identite ${deck.colorIdentity.join('')}.`,
      reading:
        "Ces cartes rendent le deck illegal en Commander, quel que soit le reste. Le controle est mecanique, pas discutable.",
      cards: illegal.map((c) => c.name),
      proposal: { kind: 'cut', quantity: illegal.length }
    }
  ]
}

/* --- Doublons ---------------------------------------------- */

function duplicates(deck: ResolvedDeck): Advice[] {
  const counts = new Map<string, number>()
  for (const c of deck.main) {
    if (/Basic Land/i.test(c.typeLine)) continue
    counts.set(c.name, (counts.get(c.name) ?? 0) + 1)
  }
  const dups = [...counts.entries()].filter(([, n]) => n > 1)
  if (dups.length === 0) return []

  return [
    {
      id: 'duplicate',
      grade: 'critique',
      title: 'Doublons hors terrains basiques',
      measure: dups.map(([n, k]) => `${n} × ${k}`).join(' · '),
      reading:
        'Le format singleton interdit les exemplaires multiples en dehors des terrains basiques.',
      cards: dups.map(([n]) => n),
      proposal: { kind: 'cut', quantity: dups.reduce((n, [, k]) => n + k - 1, 0) }
    }
  ]
}

/* --- Terrains engages -------------------------------------- */

/*
 * Se calcule sur le deck COMPLET, exemplaires compris — pas sur les noms
 * distincts. Deduplique, les vingt-quatre terrains basiques se reduisent a
 * trois entrees et le ratio de terrains engages triple artificiellement.
 */
function tappedLands(deck: ResolvedDeck): Advice[] {
  const lands = deck.main.filter((c) => c.roles.includes('land'))
  const tappedAll = lands.filter((c) => /enters tapped/i.test(c.oracleText))
  const tapped = dedupe(tappedAll)
  if (lands.length === 0) return []

  const pct = (tappedAll.length / lands.length) * 100
  if (pct < 20) return []

  return [
    {
      id: 'tapped-lands',
      grade: pct >= 33 ? 'important' : 'mineur',
      title: 'Terrains qui entrent engages',
      measure: `${tappedAll.length} terrains sur ${lands.length} entrent engages, soit ${pct.toFixed(0)} %.`,
      reading:
        "Chaque terrain engage est un demi-tour perdu. Pour un deck qui gagne en deployant vite, c'est un cout de tempo qui s'accumule sur les cinq premiers tours.",
      cards: tapped.map((c) => c.name),
      proposal: { kind: 'add', target: 'terrain', quantity: Math.min(4, tapped.length) }
    }
  ]
}

/* --- Courbe ------------------------------------------------ */

function curveWeight(unique: Card[]): Advice[] {
  const spells = unique.filter((c) => !c.roles.includes('land'))
  if (spells.length === 0) return []

  const heavy = spells.filter((c) => c.cmc >= 5)
  const cheap = spells.filter((c) => c.cmc <= 2)
  const pctHeavy = (heavy.length / spells.length) * 100

  if (pctHeavy < 22) return []

  return [
    {
      id: 'curve-top-heavy',
      grade: pctHeavy >= 30 ? 'important' : 'mineur',
      title: 'Courbe lourde du haut',
      measure:
        `${heavy.length} sorts a 5 mana ou plus (${pctHeavy.toFixed(0)} %), ` +
        `contre ${cheap.length} a 2 mana ou moins.`,
      reading:
        "Un deck qui gagne en allant large a besoin de poser plusieurs menaces par tour. Trop de cartes cheres, et les premiers tours se passent a ne rien faire.",
      cards: heavy.sort((a, b) => b.cmc - a.cmc).slice(0, 8).map((c) => `${c.name} (${c.cmc})`),
      proposal: { kind: 'add', target: 'creature', quantity: 3 }
    }
  ]
}

/* --- Categories sous-dotees --------------------------------- */

function thinCategories(unique: Card[]): Advice[] {
  const out: Advice[] = []

  for (const t of TARGETS) {
    const have = unique.filter((c) => c.roles.includes(t.role as Card['roles'][number]))
    if (have.length >= t.min) continue

    const missing = t.min - have.length
    out.push({
      id: 'category-thin',
      grade: missing >= t.min / 2 ? 'important' : 'mineur',
      title: `Categorie sous-dotee : ${t.label}`,
      measure: `${have.length} carte(s) pour un seuil de reference de ${t.min}.`,
      reading: `Il en manque ${missing} pour ${t.why}.`,
      cards: have.map((c) => c.name),
      proposal: {
        kind: 'add',
        target:
          t.role === 'draw'
            ? 'pioche'
            : t.role === 'removal'
              ? 'removal'
              : t.role === 'ramp'
                ? 'ramp'
                : 'exutoire',
        quantity: missing
      }
    })
  }

  return out
}

/* --- Poids mort -------------------------------------------- */

function deadWeight(deck: ResolvedDeck, run: SimResult | null): Advice[] {
  if (!run) return []
  const ranked = dormantRanking({ deck, run }).filter((r) => r.pct >= 8)
  if (ranked.length === 0) return []

  return [
    {
      id: 'dead-weight-cut',
      grade: 'important',
      title: 'Cartes que la campagne voit dormir',
      measure: ranked
        .slice(0, 6)
        .map((r) => `${r.card.name} (${r.pct.toFixed(0)} %)`)
        .join(' · '),
      reading:
        "Piochees mais jamais lancees, sur des centaines de parties. Ce sont les premieres coupes a envisager : leur emplacement ne sert a rien.",
      cards: ranked.map((r) => r.card.name),
      proposal: { kind: 'cut', quantity: Math.min(4, ranked.length) }
    }
  ]
}

function dedupe(cards: Card[]): Card[] {
  const seen = new Map<string, Card>()
  for (const c of cards) if (!seen.has(c.name)) seen.set(c.name, c)
  return [...seen.values()]
}
