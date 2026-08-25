import type { Card, GameRecord, SimConfig, TurnRecord } from '@shared/mtg'
import { allocate, parseCost, type ManaCost } from './mana'
import { mulberry32, shuffle } from './rng'

/*
 * Moteur de goldfishing.
 *
 * Il ne joue pas a Magic : il deroule un plan de jeu plausible et
 * l'instrumente. Ce qui l'interesse n'est pas de gagner, mais de
 * mesurer ce que la main offre tour apres tour — combien de cartes,
 * combien de mana disponible et depense, quand arrive la premiere
 * pioche, quand arrive la premiere interaction.
 *
 * Les capacites declenchees ne sont pas resolues. Trois effets seulement
 * sont modelises, parce qu'ils changent la courbe : la production de
 * mana, la pioche, et la recherche de terrain. Tout le reste est
 * comptabilise sans consequence mecanique. C'est une limite assumee :
 * l'outil mesure des tendances sur des centaines de parties, il
 * n'arbitre pas une carte isolee.
 */

interface Prepared {
  card: Card
  cost: ManaCost
  isLand: boolean
  /** Sources de mana apportees en entrant sur le champ de bataille */
  manaSources: string[] | null
  drawCount: number
  fetchesLand: boolean
  isCreature: boolean
  isInteraction: boolean
  isSacOutlet: boolean
}

function prepare(card: Card): Prepared {
  const isLand = card.roles.includes('land')
  const produces = card.producesMana.length > 0 ? card.producesMana : null

  return {
    card,
    cost: parseCost(card.manaCost),
    isLand,
    // Un terrain sans production identifiee reste une source incolore.
    manaSources: isLand ? (produces ?? ['C']) : produces,
    drawCount: drawAmount(card.oracleText),
    fetchesLand: /search your library for a[n]? (basic )?land/i.test(card.oracleText),
    isCreature: card.roles.includes('creature'),
    isInteraction: card.roles.includes('removal') || card.roles.includes('wrath'),
    isSacOutlet: card.roles.includes('sacrifice-outlet')
  }
}

const WORDS: Record<string, number> = {
  a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7
}

function drawAmount(oracle: string): number {
  // Meme forme conjuguee que dans le classement : « draws two cards ».
  const m = /draws? (\w+) cards?/i.exec(oracle)
  if (!m) return 0
  if (/opponent|each player/i.test(oracle)) return 0
  const n = WORDS[m[1].toLowerCase()] ?? Number(m[1])
  return Number.isFinite(n) ? n : 0
}

export function simulate(
  deck: { commander: Card[]; main: Card[]; name: string },
  config: SimConfig
): GameRecord[] {
  const rand = mulberry32(config.seed)
  const library = deck.main.map(prepare)
  const commanders = deck.commander.map(prepare)
  const games: GameRecord[] = []

  for (let g = 0; g < config.games; g++) {
    games.push(playGame(library, commanders, config, rand, g))
  }
  return games
}

function playGame(
  libraryTemplate: Prepared[],
  commanderTemplate: Prepared[],
  config: SimConfig,
  rand: () => number,
  index: number
): GameRecord {
  /* --- Mulligan de Londres ------------------------------------
   * On garde une main de sept comportant deux a cinq terrains, puis on
   * rend au fond de la bibliotheque autant de cartes que de mulligans.
   */
  let hand: Prepared[] = []
  let library: Prepared[] = []
  let mulligans = 0

  for (; mulligans <= 3; mulligans++) {
    library = shuffle([...libraryTemplate], rand)
    hand = library.splice(0, 7)
    const lands = hand.filter((c) => c.isLand).length
    if (lands >= 2 && lands <= 5) break
  }
  if (mulligans > 3) mulligans = 3

  for (let i = 0; i < mulligans; i++) {
    // On rend les cartes les plus cheres : c'est le choix usuel.
    hand.sort((a, b) => b.cost.cmc - a.cost.cmc)
    const back = hand.shift()
    if (back) library.push(back)
  }

  const openingLands = hand.filter((c) => c.isLand).length

  /* --- Etat de jeu ------------------------------------------- */
  const battlefieldSources: string[][] = []
  /*
   * Zone de commandement. Le commandant n'est pas dans la bibliotheque :
   * il est disponible a chaque tour, et sa taxe augmente de deux a chaque
   * fois qu'il a deja ete lance. L'ignorer fausserait toute simulation de
   * Commander — c'est la carte la plus fiablement accessible du deck.
   */
  const commandZone = commanderTemplate.map((c) => ({ card: c, casts: 0, onField: false }))
  let creatures = 0
  const rolesSeen: Record<string, number> = {}
  const landCurve: number[] = []
  const disruptions: GameRecord['disruptions'] = []
  const turns: TurnRecord[] = []
  let firstDrawSpellTurn: number | null = null
  let firstInteractionTurn: number | null = null

  const see = (c: Prepared): void => {
    for (const r of c.card.roles) rolesSeen[r] = (rolesSeen[r] ?? 0) + 1
  }
  hand.forEach(see)

  for (let turn = 1; turn <= config.maxTurns; turn++) {
    let cardsDrawn = 0

    // Le goldfish est toujours en premier : pas de pioche au tour un.
    if (turn > 1) {
      const c = library.shift()
      if (c) {
        hand.push(c)
        see(c)
        cardsDrawn++
      }
    }

    /* --- Pose de terrain ------------------------------------ */
    const landIdx = hand.findIndex((c) => c.isLand)
    let landDrop = false
    if (landIdx >= 0) {
      const [land] = hand.splice(landIdx, 1)
      battlefieldSources.push(land.manaSources ?? ['C'])
      landCurve.push(turn)
      landDrop = true
    }


    /* --- Phase principale ----------------------------------- */
    const manaAvailable = battlefieldSources.length
    let manaSpent = 0
    const spellsCast: string[] = []

    // Les sources engagees le sont pour le tour : l'allocation est reelle,
    // source par source, et non une simple soustraction de totaux.
    const tapped = new Array<boolean>(battlefieldSources.length).fill(false)

    let progress = true
    while (progress) {
      progress = false

      const playable = hand
        .map((c, i) => ({ c, i, alloc: allocate(c.cost, battlefieldSources, tapped), fromZone: false }))
        .filter((x) => !x.c.isLand && x.alloc !== null)

      // Le commandant concourt avec les cartes en main, taxe comprise.
      for (const slot of commandZone) {
        if (slot.onField) continue
        const taxed = {
          ...slot.card.cost,
          generic: slot.card.cost.generic + slot.casts * 2,
          cmc: slot.card.cost.cmc + slot.casts * 2
        }
        const alloc = allocate(taxed, battlefieldSources, tapped)
        if (alloc) {
          playable.push({ c: { ...slot.card, cost: taxed }, i: -1, alloc, fromZone: true })
        }
      }

      if (playable.length === 0) break

      /* Ordre de priorite : la rampe d'abord — elle se rembourse —,
       * puis la pioche, puis la carte la plus chere jouable, ce qui
       * maximise le mana consomme sur le tour. */
      /* Le commandant passe devant les autres creatures — il est le moteur du
       * deck — mais reste derriere la rampe et la pioche, qui se remboursent. */
      const score = (x: { c: Prepared; fromZone: boolean }): number =>
        rank(x.c, turn) + (x.fromZone ? 25 : 0)

      playable.sort((a, b) => score(b) - score(a) || b.c.cost.cmc - a.c.cost.cmc)

      const chosen = playable[0]
      if (chosen.fromZone) {
        const slot = commandZone.find((z) => z.card.card.name === chosen.c.card.name)
        if (slot) {
          slot.casts++
          slot.onField = true
        }
      } else {
        hand.splice(chosen.i, 1)
      }
      for (const idx of chosen.alloc as number[]) tapped[idx] = true
      manaSpent += chosen.c.cost.cmc
      spellsCast.push(chosen.c.card.name)

      // Une source qui entre en jeu est utilisable immediatement, et donc
      // encore dispo : le tableau des engagements grandit avec elle.
      if (chosen.c.manaSources) {
        battlefieldSources.push(chosen.c.manaSources)
        tapped.push(false)
      }
      if (chosen.c.fetchesLand) {
        const idx = library.findIndex((x) => x.isLand)
        if (idx >= 0) {
          const [land] = library.splice(idx, 1)
          battlefieldSources.push(land.manaSources ?? ['C'])
          // Un terrain cherche arrive engage dans la grande majorite des cas.
          tapped.push(true)
        }
      }
      if (chosen.c.drawCount > 0) {
        if (firstDrawSpellTurn === null) firstDrawSpellTurn = turn
        for (let d = 0; d < chosen.c.drawCount; d++) {
          const c = library.shift()
          if (c) {
            hand.push(c)
            see(c)
            cardsDrawn++
          }
        }
      }
      if (chosen.c.isCreature) creatures++
      if (chosen.c.isInteraction && firstInteractionTurn === null) firstInteractionTurn = turn

      progress = true
    }

    /* --- Perturbation adverse -------------------------------
     * En goldfish pur, rien ne vient jamais contrarier le plan, ce qui
     * flatte tous les decks. On injecte donc une pression proportionnelle
     * au nombre d'adversaires : plus la table est large, plus il passe de
     * removal et de balayages. C'est ce qui rend mesurable le besoin
     * d'interaction et de recursion.
     */
    const wrathOdds = turn >= 4 ? 0.02 * config.opponents : 0
    const removalOdds = turn >= 3 ? 0.05 * config.opponents : 0

    if (creatures > 0 && rand() < wrathOdds) {
      disruptions.push({ turn, kind: 'wrath', hit: null })
      creatures = 0
      // Le commandant retourne dans sa zone : relancable, mais taxe.
      for (const slot of commandZone) slot.onField = false
    } else if (creatures > 0 && rand() < removalOdds) {
      disruptions.push({ turn, kind: 'removal', hit: null })
      creatures--
    }

    turns.push({
      turn,
      landsInPlay: battlefieldSources.length,
      manaAvailable,
      manaSpent,
      manaWasted: Math.max(0, manaAvailable - manaSpent),
      handSize: hand.length,
      cardsDrawn,
      spellsCast,
      creaturesInPlay: creatures,
      landDrop
    })
  }

  return {
    index,
    mulligans,
    openingLands,
    turns,
    landCurve,
    disruptions,
    rolesSeen,
    firstDrawSpellTurn,
    firstInteractionTurn,
    // Une carte encore en main au terme de douze tours n'a jamais ete jouable,
    // ou jamais prioritaire : dans les deux cas, elle n'a servi a rien.
    stuckInHand: hand.filter((c) => !c.isLand).map((c) => c.card.name)
  }
}

/** Poids de priorite d'une carte au tour donne. */
function rank(c: Prepared, turn: number): number {
  if (c.manaSources && !c.isLand) return turn <= 4 ? 100 : 40
  if (c.fetchesLand) return turn <= 4 ? 95 : 35
  if (c.drawCount > 0) return 80
  if (c.isSacOutlet) return 60
  if (c.isCreature) return 50
  return 30
}
