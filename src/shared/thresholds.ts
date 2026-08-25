import type { MarketThreshold } from './types'

/**
 * Seuils de choc de marche. Franchis, ils rendent le cycle critique
 * et autorisent Boris a s'imposer au premier plan.
 * Valeurs de depart derivees des niveaux techniques du dossier v1.
 */
export const MARKET_THRESHOLDS: MarketThreshold[] = [
  {
    quoteId: 'cac40',
    direction: 'below',
    value: 8500,
    label: 'CAC 40 sous 8 500 — invalidation de la structure haussiere'
  },
  {
    quoteId: 'nasdaq',
    direction: 'below',
    value: 27176,
    label: 'Nasdaq sur son support des 27 176'
  },
  {
    quoteId: 'brent',
    direction: 'above',
    value: 100,
    label: 'Brent au-dessus de 100 $ — canal inflationniste reactive'
  },
  {
    quoteId: 'gold',
    direction: 'above',
    value: 4450,
    label: 'Or franchit 4 450 $ — objectif 4 850 $ ouvert'
  },
  {
    quoteId: 'btc',
    direction: 'below',
    value: 60000,
    label: 'Bitcoin sous 60 000 $'
  }
]
