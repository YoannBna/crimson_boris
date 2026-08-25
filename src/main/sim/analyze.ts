import type { Finding, FindingGrade, GameRecord, ResolvedDeck } from '@shared/mtg'

/*
 * Lecture d'une campagne de simulation.
 *
 * Chaque constat separe strictement ce qui est mesure de ce qui en est
 * deduit : `measure` ne contient que des chiffres, `reading` porte
 * l'interpretation. Un chiffre peut etre verifie, une lecture se discute.
 *
 * Les seuils sont calibres pour le format Commander a quatre joueurs,
 * ou une partie se joue sur dix a douze tours.
 */

const CRITICAL_TURNS = [4, 5, 6, 7, 8] as const

export function analyze(games: GameRecord[], deck: ResolvedDeck): Finding[] {
  if (games.length === 0) return []

  const findings: Finding[] = []
  const id = colorQuery(deck.colorIdentity)

  findings.push(drawStarvation(games, id))
  findings.push(emptyHand(games, id))
  findings.push(interactionShortage(games, id))
  findings.push(sacrificeOutletFragility(games, id))
  findings.push(manaScrew(games, id))
  findings.push(curveTension(games, id))
  findings.push(deadWeight(games, id))

  // Le plus grave en tete : c'est l'ordre de lecture attendu.
  const weight: Record<FindingGrade, number> = {
    critique: 0,
    desequilibre: 1,
    tension: 2,
    nominal: 3
  }
  return findings.sort((a, b) => weight[a.grade] - weight[b.grade])
}

/* ============================================================
   1 · Manque de pioche
   ============================================================ */

function drawStarvation(games: GameRecord[], id: string): Finding {
  const withDraw = games.filter((g) => g.firstDrawSpellTurn !== null)
  const lateOrNever = games.filter(
    (g) => g.firstDrawSpellTurn === null || g.firstDrawSpellTurn > 5
  )
  const medianFirst = median(withDraw.map((g) => g.firstDrawSpellTurn as number))
  const pctLate = (lateOrNever.length / games.length) * 100
  const avgHand = mean(
    games.flatMap((g) =>
      g.turns.filter((t) => (CRITICAL_TURNS as readonly number[]).includes(t.turn)).map((t) => t.handSize)
    )
  )

  const grade: FindingGrade =
    pctLate >= 60 ? 'critique' : pctLate >= 40 ? 'desequilibre' : pctLate >= 25 ? 'tension' : 'nominal'

  return {
    id: 'draw-starvation',
    grade,
    title: 'Acces a la pioche',
    measure:
      `Premier effet de pioche au tour ${fmt(medianFirst)} en mediane. ` +
      `${pctLate.toFixed(0)} % des parties sans pioche avant le tour 6. ` +
      `Main moyenne des tours 4 a 8 : ${avgHand.toFixed(1)} cartes.`,
    reading:
      grade === 'nominal'
        ? "Le deck renouvelle ses ressources a temps : aucune correction n'est requise sur cet axe."
        : grade === 'tension'
          ? 'La pioche arrive, mais tard. Le deck traverse le milieu de partie sur ses seules ressources initiales.'
          : "Le deck epuise sa main avant d'avoir gagne. Sur une table a quatre, c'est la premiere cause de defaite d'un aggro large : le plateau tombe et rien ne le remplace.",
    remedies:
      grade === 'nominal'
        ? []
        : [
            {
              label: 'Moteurs de pioche recurrents, peu chers',
              query: `${id} (o:"draw a card" or o:"draw two cards") (t:artifact or t:enchantment) usd<5 -t:land`
            },
            {
              label: 'Pioche liee aux creatures qui meurent',
              query: `${id} o:"whenever" o:"dies" o:"draw a card" usd<8`
            },
            {
              label: 'Pioche a large volume, un coup',
              query: `${id} o:"draw" o:"cards equal to" usd<10 -t:land`
            }
          ]
  }
}

/* ============================================================
   2 · Main vide
   ============================================================ */

function emptyHand(games: GameRecord[], id: string): Finding {
  const late = games.flatMap((g) => g.turns.filter((t) => t.turn >= 4))
  const empty = late.filter((t) => t.handSize <= 1)
  const pct = late.length === 0 ? 0 : (empty.length / late.length) * 100

  const firstEmpty = games
    .map((g) => g.turns.find((t) => t.turn >= 3 && t.handSize === 0)?.turn ?? null)
    .filter((x): x is number => x !== null)

  const grade: FindingGrade =
    pct >= 45 ? 'critique' : pct >= 30 ? 'desequilibre' : pct >= 18 ? 'tension' : 'nominal'

  return {
    id: 'empty-hand',
    grade,
    title: 'Assechement de la main',
    measure:
      `${pct.toFixed(0)} % des tours a partir du quatrieme se jouent a une carte ou moins. ` +
      (firstEmpty.length > 0
        ? `Main vide des le tour ${fmt(median(firstEmpty))} en mediane, dans ${((firstEmpty.length / games.length) * 100).toFixed(0)} % des parties.`
        : 'Aucune partie ne se termine main vide.'),
    reading:
      grade === 'nominal'
        ? 'La main reste alimentee tout au long de la partie.'
        : "Le deck deploie plus vite qu'il ne se recharge. Chaque balayage adverse devient alors definitif, faute de seconde vague.",
    remedies:
      grade === 'nominal'
        ? []
        : [
            {
              label: 'Rechargement de main',
              query: `${id} o:"draw" o:"until you have" usd<12 -t:land`
            },
            {
              label: 'Avantage de carte a cout nul, adapte aux jetons',
              query: `${id} t:equipment o:"draw" usd<6`
            }
          ]
  }
}

/* ============================================================
   3 · Manque d'interaction
   ============================================================ */

function interactionShortage(games: GameRecord[], id: string): Finding {
  const noneEarly = games.filter(
    (g) => g.firstInteractionTurn === null || g.firstInteractionTurn > 6
  )
  const pct = (noneEarly.length / games.length) * 100
  const avgSeen = mean(
    games.map((g) => (g.rolesSeen['removal'] ?? 0) + (g.rolesSeen['wrath'] ?? 0))
  )
  const disruptionsTaken = mean(games.map((g) => g.disruptions.length))

  const grade: FindingGrade =
    pct >= 60 ? 'critique' : pct >= 42 ? 'desequilibre' : pct >= 28 ? 'tension' : 'nominal'

  return {
    id: 'interaction-shortage',
    grade,
    title: 'Capacite de reponse',
    measure:
      `${pct.toFixed(0)} % des parties sans la moindre interaction avant le tour 7. ` +
      `${avgSeen.toFixed(1)} effet(s) d'interaction vus par partie. ` +
      `${disruptionsTaken.toFixed(1)} perturbation(s) adverse(s) subies par partie.`,
    reading:
      grade === 'nominal'
        ? 'Le deck dispose de reponses au moment ou elles comptent.'
        : "Le deck ne sait qu'attaquer. Il subit la premiere menace adverse sans pouvoir y repondre, et perd l'initiative qu'il a mis cinq tours a construire.",
    remedies:
      grade === 'nominal'
        ? []
        : [
            {
              label: 'Removal ponctuel bon marche',
              query: `${id} o:"destroy target creature" cmc<=3 usd<3 -t:land`
            },
            {
              label: 'Removal a large spectre',
              query: `${id} o:"destroy target" (o:"artifact" or o:"enchantment") cmc<=4 usd<6`
            },
            {
              label: 'Balayage asymetrique',
              query: `${id} o:"destroy all" (o:"except" or o:"non") usd<15`
            }
          ]
  }
}

/* ============================================================
   4 · Fragilite de l'exutoire de sacrifice
   ============================================================ */

function sacrificeOutletFragility(games: GameRecord[], id: string): Finding {
  const none = games.filter((g) => (g.rolesSeen['sacrifice-outlet'] ?? 0) === 0)
  const pct = (none.length / games.length) * 100
  const avg = mean(games.map((g) => g.rolesSeen['sacrifice-outlet'] ?? 0))
  const tokens = mean(games.map((g) => g.rolesSeen['token-maker'] ?? 0))

  const grade: FindingGrade =
    pct >= 55 ? 'critique' : pct >= 35 ? 'desequilibre' : pct >= 20 ? 'tension' : 'nominal'

  return {
    id: 'sacrifice-outlet-fragility',
    grade,
    title: 'Exutoires de sacrifice',
    measure:
      `${pct.toFixed(0)} % des parties ne voient aucun exutoire libre. ` +
      `${avg.toFixed(1)} exutoire(s) vu(s) par partie, pour ${tokens.toFixed(1)} generateur(s) de jetons.`,
    reading:
      grade === 'nominal'
        ? 'Le moteur aristocrates trouve son exutoire de maniere fiable.'
        : "Les generateurs de jetons tournent a vide : sans exutoire, les jetons ne se convertissent jamais en degats. Le plan de secours du deck depend d'une carte que l'on ne voit pas.",
    remedies:
      grade === 'nominal'
        ? []
        : [
            {
              label: 'Exutoires libres, sans cout de mana',
              query: `${id} o:"sacrifice a creature:" cmc<=2 usd<4`
            },
            {
              label: 'Exutoire et drain combines',
              query: `${id} o:"sacrifice" o:"loses life" cmc<=3 usd<8`
            }
          ]
  }
}

/* ============================================================
   5 · Mana — collecte annexe
   ============================================================ */

function manaScrew(games: GameRecord[], id: string): Finding {
  const third = games.map((g) => g.landCurve[2] ?? 99).filter((t) => t < 99)
  const fourth = games.map((g) => g.landCurve[3] ?? 99).filter((t) => t < 99)
  const missed = games.flatMap((g) =>
    g.turns.filter((t) => t.turn <= 6 && !t.landDrop && t.landsInPlay < 5)
  )
  const totalEarly = games.reduce(
    (n, g) => n + g.turns.filter((t) => t.turn <= 6).length,
    0
  )
  const pctMissed = totalEarly === 0 ? 0 : (missed.length / totalEarly) * 100
  const mull = mean(games.map((g) => g.mulligans))

  const grade: FindingGrade =
    pctMissed >= 32 ? 'critique' : pctMissed >= 22 ? 'desequilibre' : pctMissed >= 14 ? 'tension' : 'nominal'

  return {
    id: 'mana-screw',
    grade,
    title: 'Deroulement de la base de mana',
    measure:
      `Troisieme source au tour ${fmt(median(third))}, quatrieme au tour ${fmt(median(fourth))} en mediane. ` +
      `${pctMissed.toFixed(0)} % des six premiers tours sans pose de terrain sous cinq sources. ` +
      `${mull.toFixed(2)} mulligan(s) par partie.`,
    reading:
      grade === 'nominal'
        ? 'La base se deroule normalement sur les premiers tours.'
        : "Le deploiement s'enraye tot. Pour un deck qui gagne en allant large et vite, chaque tour sans terrain est un tour de retard qui ne se rattrape pas.",
    remedies:
      grade === 'nominal'
        ? []
        : [
            {
              label: 'Fixateurs de couleur a deux mana',
              query: `${id} t:artifact cmc=2 o:"add" usd<3`
            },
            {
              label: 'Terrains non-basiques qui entrent degages',
              query: `${id} t:land -o:"enters tapped" -t:basic usd<8`
            }
          ]
  }
}

/* ============================================================
   6 · Courbe contre plan de jeu
   ============================================================ */

function curveTension(games: GameRecord[], id: string): Finding {
  const early = games.flatMap((g) => g.turns.filter((t) => t.turn >= 2 && t.turn <= 7))
  const wasted = mean(early.map((t) => t.manaWasted))
  const idleTurns = early.filter((t) => t.spellsCast.length === 0)
  const pctIdle = early.length === 0 ? 0 : (idleTurns.length / early.length) * 100

  const grade: FindingGrade =
    wasted >= 2.2 ? 'critique' : wasted >= 1.5 ? 'desequilibre' : wasted >= 1.0 ? 'tension' : 'nominal'

  return {
    id: 'curve-tension',
    grade,
    title: 'Courbe contre plan de jeu',
    measure:
      `${wasted.toFixed(2)} mana non depense par tour en moyenne, du tour 2 au tour 7. ` +
      `${pctIdle.toFixed(0)} % de ces tours se passent sans lancer le moindre sort.`,
    reading:
      grade === 'nominal'
        ? 'Le mana disponible est consomme a mesure.'
        : "Trop de mana dort. Soit la courbe est trop haute pour ce que la base produit, soit il manque des sorts bon marche a poser les tours ou rien ne se passe.",
    remedies:
      grade === 'nominal'
        ? []
        : [
            {
              label: 'Sorts a un ou deux mana pour combler la courbe basse',
              query: `${id} cmc<=2 -t:land usd<4 f:commander`
            }
          ]
  }
}

/* ============================================================
   7 · Cartes qui dorment en main
   ============================================================ */

function deadWeight(games: GameRecord[], id: string): Finding {
  const stuckPerGame = mean(games.map((g) => g.stuckInHand.length))

  // Frequence par carte : combien de parties l'ont laissee en main ?
  const counts = new Map<string, number>()
  for (const g of games) {
    for (const name of new Set(g.stuckInHand)) {
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
  }
  const worst = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, n]) => `${name} (${((n / games.length) * 100).toFixed(0)} %)`)

  const grade: FindingGrade =
    stuckPerGame >= 4 ? 'critique' : stuckPerGame >= 3 ? 'desequilibre' : stuckPerGame >= 2 ? 'tension' : 'nominal'

  return {
    id: 'dead-weight',
    grade,
    title: 'Cartes qui dorment en main',
    measure:
      `${stuckPerGame.toFixed(1)} carte(s) non-terrain encore en main au douzieme tour. ` +
      (worst.length > 0 ? `Les plus souvent bloquees : ${worst.join(' · ')}.` : ''),
    reading:
      grade === 'nominal'
        ? 'La main se vide de ses sorts : rien ne reste durablement injouable.'
        : "Ces cartes ont ete piochees sans jamais pouvoir etre lancees, ou sans jamais valoir mieux qu'autre chose. Une carte bloquee dans plus d'une partie sur deux ou elle apparait est un emplacement de deck perdu — c'est le premier endroit ou couper.",
    remedies: []
  }
}

/* ============================================================
   Outils
   ============================================================ */

/** Restreint une requete Scryfall a l'identite couleur du commandant. */
function colorQuery(identity: string[]): string {
  if (identity.length === 0) return 'f:commander'
  return `id<=${identity.join('').toLowerCase()} f:commander`
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function median(xs: number[]): number {
  if (xs.length === 0) return NaN
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(1).replace(/\.0$/, '') : '—'
}
