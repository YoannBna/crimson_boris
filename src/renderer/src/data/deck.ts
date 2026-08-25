/* ============================================================
   Arsenal ludique — profil du deck Edgar Markov.
   Archetype de demonstration livre avec l'application.
   L'etape 4 remplace ce profil fige par une resolution Scryfall
   carte par carte, via l'importeur de fichier.
   ============================================================ */

export interface DistRow {
  label: string
  value: number
  /** largeur relative de la barre, 0-100 */
  width: number
  land?: boolean
}

export const DECK_IDENTITY = {
  commander: 'Edgar Markov',
  typeLine: 'Legendary Creature : Knight Vampire',
  colorIdentity: 'Mardu',
  archetype: 'tribal Vampires — aggro large a moteur aristocrates',
  // Aucun identifiant de deck personnel : le profil de repli est une
  // demonstration de l'archetype, pas le deck de quelqu'un en particulier.
  source: 'profil de demonstration'
}

export const DECK_KPI = [
  { label: 'EN DECK', value: '104', sub: '83 entrees distinctes' },
  { label: 'LIMITE FORMAT', value: '100', sub: 'Ecart : +4' },
  { label: 'EN RESERVE', value: '63', sub: '36 ecartees / 27 maybeboard' },
  { label: 'TERRAINS', value: '36', sub: '24 basiques / 12 speciaux' },
  { label: 'MANA MOYEN', value: '3,68', sub: 'Source Archidekt' }
]

export const FUNCTION_DIST: DistRow[] = [
  { label: 'Terrains', value: 36, width: 100, land: true },
  { label: 'Ramp', value: 9, width: 25 },
  { label: 'Removal', value: 8, width: 22 },
  { label: 'Pioche', value: 8, width: 22 },
  { label: 'Jetons', value: 7, width: 19 },
  { label: 'Compteurs', value: 6, width: 17 },
  { label: 'Aristocrates', value: 5, width: 14 },
  { label: 'Recursion', value: 5, width: 14 },
  { label: 'Protection', value: 5, width: 14 },
  { label: 'Anthems', value: 4, width: 11 },
  { label: 'Viande', value: 4, width: 11 },
  { label: 'Drain', value: 3, width: 8 },
  { label: 'Wraths', value: 2, width: 6 },
  { label: 'Enchantement', value: 1, width: 3 },
  { label: 'Commandant', value: 1, width: 3 }
]

export const MANA_DIST: DistRow[] = [
  { label: 'Noir', value: 18, width: 100 },
  { label: 'Blanc', value: 14, width: 78 },
  { label: 'Rouge', value: 12, width: 67 },
  { label: 'Basiques', value: 24, width: 67, land: true },
  { label: 'Non-basiques', value: 12, width: 33, land: true }
]

export interface KeyCard {
  role: string
  roleCls: 'r-core' | 'r-eng' | 'r-win'
  name: string
  body: string
  /** segments a mettre en exergue dans body */
  strong?: string[]
}

export const KEY_CARDS: KeyCard[] = [
  {
    role: 'Moteur central',
    roleCls: 'r-core',
    name: 'Edgar Markov',
    body:
      "L'eminence produit un jeton par sort de vampire depuis la zone de commandement. Le deck tourne meme quand le commandant est neutralise — aucun autre commandant tribal n'offre cette immunite structurelle.",
    strong: ['depuis la zone de commandement']
  },
  {
    role: 'Condition de victoire',
    roleCls: 'r-win',
    name: "Cathars' Crusade",
    body:
      "Chaque creature entrant place un marqueur +1/+1 sur toutes les autres. L'eminence double mecaniquement les declenchements : le sort, puis son jeton. Deux tours de deploiement rendent le plateau letal.",
    strong: ['double mecaniquement les declenchements']
  },
  {
    role: 'Multiplicateur',
    roleCls: 'r-core',
    name: 'Teysa Karlov',
    body:
      'Double tous les declenchements de mort : Blood Artist, Cruel Celebrant, Falkenrath Noble, Vengeful Bloodwitch et Elenda simultanement. La piece la plus dense du deck.',
    strong: ['La piece la plus dense du deck.']
  },
  {
    role: 'Voie alternative',
    roleCls: 'r-win',
    name: 'Blood Artist & la triade de drain',
    body:
      'Avec Cruel Celebrant et Falkenrath Noble, convertit chaque mort en degats inevitables. Plan B quand le combat est verrouille, plan A quand un wrath frappe un plateau large.',
    strong: ['Plan B quand le combat est verrouille, plan A quand un wrath frappe un plateau large.']
  },
  {
    role: 'Moteur autonome',
    roleCls: 'r-eng',
    name: 'Bloodline Keeper',
    body:
      'Un jeton Vampire par tour sans depense de carte, puis bascule en seigneur anthem. Avantage materiel a cout nul une fois pose.',
    strong: ['a cout nul']
  },
  {
    role: 'Exutoire & ramp',
    roleCls: 'r-eng',
    name: 'Warren Soultrader',
    body:
      "Sacrifice gratuit et illimite, converti en tresor. Pivot qui relie les jetons de l'eminence aux aristocrates. Vigilance : c'est le seul exutoire libre du deck hors Phyrexian Tower.",
    strong: ["Vigilance : c'est le seul exutoire libre du deck"]
  },
  {
    role: 'Menace differee',
    roleCls: 'r-win',
    name: 'Elenda, the Dusk Rose',
    body:
      "Accumule des marqueurs a chaque mort, puis se convertit en armee de vampires en mourant. Repond au removal en s'aggravant. Effet double sous Teysa Karlov.",
    strong: ["Repond au removal en s'aggravant."]
  }
]
