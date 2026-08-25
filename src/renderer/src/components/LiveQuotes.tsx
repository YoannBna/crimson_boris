import type { MarketSnapshot } from '@shared/types'
import { MARKET_THRESHOLDS } from '@shared/thresholds'
import { Note } from './primitives'

function fmt(n: number | null, digits?: number): string {
  if (n === null) return '—'
  // Une parite de devises se lit a quatre decimales ; un indice a deux.
  const d = digits ?? (Math.abs(n) < 10 ? 4 : 2)
  return n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function tone(pct: number | null): string {
  if (pct === null) return 'fl'
  if (pct > 0.05) return 'up'
  if (pct < -0.05) return 'dn'
  return 'fl'
}

export function LiveQuotes({ snapshot }: { snapshot: MarketSnapshot | null }) {
  if (!snapshot) {
    return (
      <Note>
        Aucune collecte aboutie pour l'instant. Le premier cycle s'execute au demarrage de Boris,
        puis a chaque sortie de veille.
      </Note>
    )
  }

  // Le volet asymetries a sa propre table : ne restent ici que les directeurs.
  const core = snapshot.quotes.filter((q) => q.category === 'core')

  const stamp = new Date(snapshot.fetchedAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Actif</th>
            <th className="n">Cours</th>
            <th className="n">Var.</th>
            <th className="n">Seuil</th>
            <th>Etat</th>
          </tr>
        </thead>
        <tbody>
          {core.map((q) => {
            const th = MARKET_THRESHOLDS.find((t) => t.quoteId === q.id)
            const breached =
              th && q.price !== null
                ? th.direction === 'below'
                  ? q.price < th.value
                  : q.price > th.value
                : false
            return (
              <tr key={q.id}>
                <td className="sym">{q.label}</td>
                <td className="n">{fmt(q.price)}</td>
                <td className={`n ${tone(q.changePercent)}`}>
                  {q.changePercent === null
                    ? '—'
                    : `${q.changePercent >= 0 ? '+' : ''}${q.changePercent.toFixed(2)} %`}
                </td>
                <td className="n fl">
                  {th ? `${th.direction === 'below' ? '<' : '>'} ${fmt(th.value, 0)}` : '—'}
                </td>
                <td>
                  {q.error ? (
                    <span className="tag t-cold">indisponible</span>
                  ) : breached ? (
                    <span className="tag t-crit">seuil franchi</span>
                  ) : (
                    <span className="tag t-ok">nominal</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <Note>
        Collecte de <b>{stamp}</b> — {snapshot.ok} / {snapshot.total} cotations obtenues, tous
        volets confondus. Source :
        point d'acces public Yahoo Finance, non contractuel. C'est le <b>franchissement</b> d'un
        seuil qui rend le cycle critique et autorise Boris a s'imposer a l'ecran — un seuil deja
        franchi au cycle precedent reste en simple <b>surveillance</b>.
      </Note>
    </>
  )
}
