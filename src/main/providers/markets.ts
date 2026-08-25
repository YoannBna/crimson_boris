import type { MarketQuote, MarketSnapshot, QuoteCategory } from '@shared/types'
import { RequestQueue } from './http'

/**
 * Source : point d'acces graphique public de Yahoo Finance.
 * Gratuit, sans cle, couvre indices / matieres / devises / crypto.
 * Contrepartie a assumer : il n'est pas contractuel et peut changer
 * sans preavis — d'ou l'isolement derriere cette seule fonction.
 */
const BASE = 'https://query1.finance.yahoo.com/v8/finance/chart'

// Aucune adresse personnelle dans les en-tetes sortants : le User-Agent
// part a chaque requete et n'a pas a identifier l'operateur.
const UA = 'CrimsonBoris/2.0 (+https://github.com/crimson-boris)'

const queue = new RequestQueue(150, UA)

interface Tracked {
  id: string
  label: string
  symbol: string
  category: QuoteCategory
}

/*
 * Volet directeur : les niveaux qui commandent la lecture macro.
 * Volet asymetries : dix positions de rupture, cotees en direct comme
 * les autres — la these qui les justifie vit dans le renderer, mais le
 * cours, lui, doit etre reel. Elles ne portent aucun seuil de choc :
 * une valeur de rupture bouge de dix pour cent sans que rien de notable
 * ne se soit produit, et Boris crierait a chaque cycle.
 */
export const TRACKED: Tracked[] = [
  { id: 'cac40', label: 'CAC 40', symbol: '^FCHI', category: 'core' },
  { id: 'sp500', label: 'S&P 500', symbol: '^GSPC', category: 'core' },
  { id: 'nasdaq', label: 'Nasdaq', symbol: '^IXIC', category: 'core' },
  { id: 'brent', label: 'Brent', symbol: 'BZ=F', category: 'core' },
  { id: 'gold', label: 'Or (once)', symbol: 'GC=F', category: 'core' },
  { id: 'eurusd', label: 'EUR / USD', symbol: 'EURUSD=X', category: 'core' },
  { id: 'btc', label: 'Bitcoin', symbol: 'BTC-USD', category: 'core' },

  { id: 'nvda', label: 'NVIDIA', symbol: 'NVDA', category: 'asymmetry' },
  { id: 'asml', label: 'ASML', symbol: 'ASML', category: 'asymmetry' },
  { id: 'tsm', label: 'TSMC', symbol: 'TSM', category: 'asymmetry' },
  { id: 'mu', label: 'Micron', symbol: 'MU', category: 'asymmetry' },
  { id: 'ionq', label: 'IonQ', symbol: 'IONQ', category: 'asymmetry' },
  { id: 'ceg', label: 'Constellation', symbol: 'CEG', category: 'asymmetry' },
  { id: 'rhm', label: 'Rheinmetall', symbol: 'RHM.DE', category: 'asymmetry' },
  { id: 'ho', label: 'Thales', symbol: 'HO.PA', category: 'asymmetry' },
  { id: 'tsla', label: 'Tesla', symbol: 'TSLA', category: 'asymmetry' },
  { id: 'remx', label: 'VanEck Rare Earth', symbol: 'REMX', category: 'asymmetry' }
]

interface ChartMeta {
  currency?: string
  regularMarketPrice?: number
  previousClose?: number
  chartPreviousClose?: number
  regularMarketTime?: number
}

interface ChartResponse {
  chart?: {
    result?: { meta?: ChartMeta }[]
    error?: { description?: string } | null
  }
}

async function fetchOne(t: Tracked): Promise<MarketQuote> {
  const base: MarketQuote = {
    id: t.id,
    category: t.category,
    label: t.label,
    symbol: t.symbol,
    price: null,
    previousClose: null,
    changePercent: null,
    currency: null,
    asOf: null
  }

  try {
    const url = `${BASE}/${encodeURIComponent(t.symbol)}?interval=1d&range=5d`
    const data = await queue.getJson<ChartResponse>(url)
    const meta = data.chart?.result?.[0]?.meta

    if (!meta || typeof meta.regularMarketPrice !== 'number') {
      const why = data.chart?.error?.description ?? 'cotation absente de la reponse'
      return { ...base, error: why }
    }

    const price = meta.regularMarketPrice
    const prev = meta.previousClose ?? meta.chartPreviousClose ?? null
    const change = prev && prev !== 0 ? ((price - prev) / prev) * 100 : null

    return {
      ...base,
      price,
      previousClose: prev,
      changePercent: change,
      currency: meta.currency ?? null,
      asOf: meta.regularMarketTime
        ? new Date(meta.regularMarketTime * 1000).toISOString()
        : new Date().toISOString()
    }
  } catch (err) {
    return { ...base, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Une passe complete. Ne rejette jamais : chaque echec reste local a sa cotation. */
export async function fetchMarkets(): Promise<MarketSnapshot> {
  const quotes: MarketQuote[] = []
  for (const t of TRACKED) {
    quotes.push(await fetchOne(t))
  }
  return {
    fetchedAt: new Date().toISOString(),
    quotes,
    ok: quotes.filter((q) => q.price !== null).length,
    total: quotes.length
  }
}
