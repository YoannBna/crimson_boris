import { useMemo, useState } from 'react'
import type { MarketQuote, MarketSnapshot } from '@shared/types'
import { ASYMMETRIES, AXIS_LABEL, type Axis, type Asymmetry } from '@/data/asymmetries'
import { Card, Note } from '@/components/primitives'

type SortKey = 'defaut' | 'variation' | 'axe'

function fmtPrice(q: MarketQuote | undefined): string {
  if (!q || q.price === null) return '—'
  const d = Math.abs(q.price) < 10 ? 4 : 2
  const n = q.price.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })
  return q.currency === 'EUR' ? `${n} €` : q.currency === 'USD' ? `${n} $` : n
}

function fmtChange(q: MarketQuote | undefined): { text: string; cls: string } {
  if (!q || q.changePercent === null) return { text: '—', cls: 'fl' }
  const v = q.changePercent
  return {
    text: `${v >= 0 ? '+' : ''}${v.toFixed(2)} %`,
    cls: v > 0.05 ? 'up' : v < -0.05 ? 'dn' : 'fl'
  }
}

export function AsymmetryPanel({ snapshot }: { snapshot: MarketSnapshot | null }) {
  const [sort, setSort] = useState<SortKey>('defaut')
  const [open, setOpen] = useState<string | null>(null)

  const quotes = useMemo(() => {
    const m = new Map<string, MarketQuote>()
    for (const q of snapshot?.quotes ?? []) m.set(q.id, q)
    return m
  }, [snapshot])

  const rows = useMemo(() => {
    const list = [...ASYMMETRIES]
    if (sort === 'variation') {
      list.sort(
        (a, b) =>
          (quotes.get(b.quoteId)?.changePercent ?? -Infinity) -
          (quotes.get(a.quoteId)?.changePercent ?? -Infinity)
      )
    } else if (sort === 'axe') {
      list.sort((a, b) => AXIS_LABEL[a.axis].localeCompare(AXIS_LABEL[b.axis]))
    }
    return list
  }, [sort, quotes])

  const covered = rows.filter((r) => quotes.get(r.quoteId)?.price !== null).length

  return (
    <Card full title="◈ Asymetries radicales — dix positions de rupture">
      <div className="asym-bar">
        <span className="asym-count">
          <b>{rows.length}</b> positions · <b>{covered}</b> cotees en direct
        </span>
        <div className="asym-sort">
          {(['defaut', 'variation', 'axe'] as SortKey[]).map((k) => (
            <button
              key={k}
              className={`asym-tab${sort === k ? ' on' : ''}`}
              onClick={() => setSort(k)}
            >
              {k === 'defaut' ? 'Conviction' : k === 'variation' ? 'Variation' : 'Axe'}
            </button>
          ))}
        </div>
      </div>

      <div className="asym-scroll">
        {rows.map((a) => (
          <Row
            key={a.quoteId}
            asym={a}
            quote={quotes.get(a.quoteId)}
            open={open === a.quoteId}
            onToggle={() => setOpen(open === a.quoteId ? null : a.quoteId)}
          />
        ))}
      </div>

      <Note>
        Selection arretee sur quatre criteres : rupture technique, presence dans l'actualite,
        poids geostrategique, potentiel de revenus. Les cours proviennent du meme releve que le
        radar principal ; <b>les impacts sur revenus futurs sont des estimations</b>, jamais des
        donnees constatees. Aucun seuil de choc n'est arme sur ces lignes : leur volatilite
        normale declencherait une alerte a chaque cycle.
      </Note>
    </Card>
  )
}

function Row({
  asym,
  quote,
  open,
  onToggle
}: {
  asym: Asymmetry
  quote: MarketQuote | undefined
  open: boolean
  onToggle: () => void
}) {
  const change = fmtChange(quote)

  return (
    <div className={`asym ax-${asym.axis}${open ? ' open' : ''}`}>
      <button className="asym-h" onClick={onToggle} aria-expanded={open}>
        <span className="asym-tick">{asym.ticker}</span>
        <span className="asym-name">{asym.name}</span>
        <span className="asym-axis">{AXIS_LABEL[asym.axis]}</span>
        <span className="asym-price">{fmtPrice(quote)}</span>
        <span className={`asym-var ${change.cls}`}>{change.text}</span>
        <span className="asym-chev">{open ? '−' : '+'}</span>
      </button>

      <div className="asym-b">
        <p className="asym-rupture">{asym.rupture}</p>
        {open && (
          <dl className="asym-dl">
            <dt>Reseau</dt>
            <dd>{asym.network}</dd>
            <dt>Impact revenus</dt>
            <dd>{asym.impact}</dd>
            <dt>Ce qui l'invalide</dt>
            <dd className="asym-risk">{asym.risk}</dd>
          </dl>
        )}
      </div>
    </div>
  )
}

/** Expose les axes pour d'eventuelles legendes. */
export const AXES: Axis[] = [...new Set(ASYMMETRIES.map((a) => a.axis))]
