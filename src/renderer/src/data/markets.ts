/* ============================================================
   Radar financier — jeu de donnees de reference.
   Ces valeurs sont le SNAPSHOT du 20/08/2026 issu de la v1.
   L'etape 3 branchera un fetcher qui remplacera ce module
   par des cotations reelles ; la forme des types ne bouge pas.
   ============================================================ */

export type Tone = 'up' | 'dn' | 'fl'

export interface Quote {
  symbol: string
  level: string
  change: string
  tone: Tone
  reading: string
  /** true une fois la valeur alimentee par le fetcher temps reel */
  live?: boolean
}

export interface EtfGrid {
  title: string
  name: string
  signal: string
  signalCls: 's-hold' | 's-asym' | 's-rot'
  conviction: number // 0-100, largeur de la barre
  body: string
}

/** Horodatage du snapshot statique — remplace par l'heure de fetch a l'etape 3. */
export const MARKETS_AS_OF = '2026-08-20T00:00:00+02:00'

export const QUOTES: Quote[] = [
  { symbol: 'CAC 40', level: '8 509', change: '-0,82 %', tone: 'dn', reading: '7e repli sur 8 seances' },
  { symbol: 'CAC 40 — record', level: '8 740+', change: '—', tone: 'fl', reading: 'Plus haut historique recent' },
  { symbol: 'S&P 500', level: '7 816,70', change: 'record', tone: 'up', reading: 'Cible Fibo 7 857,62' },
  { symbol: 'Nasdaq', level: '< 30 660', change: 'bride', tone: 'fl', reading: 'Resistance / support 27 176' },
  { symbol: 'Brent', level: '91+ $', change: 'hausse', tone: 'up', reading: 'Moteur inflationniste' },
  { symbol: 'EUR / USD', level: '1,160', change: '+0,26 %', tone: 'up', reading: 'Range 1,1460 – 1,1910' }
]

export const ETF_GRIDS: EtfGrid[] = [
  {
    title: '▤ Grille ETF — Indice World',
    name: 'MSCI World / ACWI',
    signal: 'NEUTRE – PORTEUR',
    signalCls: 's-hold',
    conviction: 62,
    body:
      "Tire par les records du S&P 500. Deux reserves : concentration technologique extreme et " +
      'compression des multiples par les taux longs. On tient, on ne renforce pas.'
  },
  {
    title: '▤ Grille ETF — Emergents',
    name: 'MSCI Emerging Markets',
    signal: 'ASYMETRIQUE',
    signalCls: 's-asym',
    conviction: 48,
    body:
      "Dollar faible = vent porteur. Mais un Brent > 91 $ penalise les importateurs nets (Inde, " +
      "Turquie). L'exposition depend du scenario Ormuz, pas de la valorisation."
  },
  {
    title: '▤ Grille ETF — Momentum',
    name: 'Selection Momentum',
    signal: 'ROTATION EN COURS',
    signalCls: 's-rot',
    conviction: 35,
    body:
      "Le momentum tech s'essouffle. Le relais se forme sur l'energie et les metaux precieux. " +
      'Risque classique : les indices momentum rebalancent avec retard et achetent le sommet sortant.'
  }
]
