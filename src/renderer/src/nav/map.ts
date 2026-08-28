/* ============================================================
   Carte de navigation
   ============================================================ */

export type ModeId = 'opti' | 'forge'

export interface NodeDef {
  id: string
  label: string
  /** Une ligne, affichee sous le titre dans la miniature */
  role: string
  /** Position sur l'orbite, en degres. 0 = midi, sens horaire. */
  angle: number
  /** Distance au centre, en fraction du rayon de l'orbite */
  reach: number
}

export interface ModeDef {
  id: ModeId
  label: string
  tagline: string
  /** Teinte dominante : la constellation s'y accorde */
  tone: 'cold' | 'warm'
  nodes: NodeDef[]
}

/*
 * Les angles sont choisis a la main plutot que repartis egalement :
 * une constellation reguliere ressemble a un cadran, pas a un ciel.
 * Les distances varient pour la meme raison.
 *
 * Le secteur du haut reste libre : l'avatar s'y ancre une fois active,
 * et un noeud pose la se retrouvait sous la sphere.
 */
export const MODES: ModeDef[] = [
  {
    id: 'opti',
    label: 'OPTI',
    tagline: 'finances · courrier · productivite',
    tone: 'cold',
    nodes: [
      { id: 'marches', label: 'Marches', role: 'cotations et seuils de choc', angle: -52, reach: 1.02 },
      { id: 'veille', label: 'Veille', role: 'flux et scenarios de risque', angle: 46, reach: 0.9 },
      { id: 'courrier', label: 'Courrier', role: 'signal isole du bruit', angle: 96, reach: 1.04 },
      { id: 'actions', label: 'Actions', role: 'echeances et gravite', angle: 178, reach: 0.9 },
      { id: 'asymetries', label: 'Asymetries', role: 'dix positions de rupture', angle: -118, reach: 1.12 }
    ]
  },
  {
    id: 'forge',
    label: 'FORGE',
    tagline: 'magic : the gathering',
    tone: 'warm',
    nodes: [
      { id: 'deck', label: 'Deck', role: 'cartes par categorie', angle: -56, reach: 1.06 },
      { id: 'analyse', label: 'Analyse', role: 'forces et defauts, sans propositions', angle: 42, reach: 0.92 },
      { id: 'simulation', label: 'Simulation', role: 'scenarios virtuels', angle: 88, reach: 1.02 },
      { id: 'construction', label: 'Construction', role: 'suggestions et directives', angle: 168, reach: 0.94 },
      { id: 'arts', label: 'Arts', role: 'variantes graphiques', angle: -122, reach: 1.1 }
    ]
  }
]

export function findMode(id: ModeId): ModeDef {
  const m = MODES.find((x) => x.id === id)
  if (!m) throw new Error(`Mode inconnu : ${id}`)
  return m
}

/** Position cartesienne d'un noeud, en pourcentage du conteneur. */
export function nodePosition(n: NodeDef, radius = 32): { x: number; y: number } {
  const rad = ((n.angle - 90) * Math.PI) / 180
  return {
    x: 50 + Math.cos(rad) * radius * n.reach,
    // Centre abaisse : le haut de l'ecran appartient a l'avatar.
    y: 56 + Math.sin(rad) * radius * n.reach
  }
}
