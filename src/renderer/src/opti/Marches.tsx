import type { MarketQuote, MarketSnapshot, SeverityHit } from '@shared/types'
import { MARKET_THRESHOLDS } from '@shared/thresholds'
import { Bloc } from '@/forge/VoletAnalyse'

/* ============================================================
   Marches — cotations et seuils de choc
   ============================================================ */

export function Marches({
  snapshot,
  hits
}: {
  snapshot: MarketSnapshot | null
  hits: SeverityHit[]
}) {
  const core = snapshot?.quotes.filter((q) => q.category === 'core') ?? []
  const chocs = hits.filter((h) => h.rule === 'market-shock')

  return (
    <div className="vp">
      <Bloc titre={`Cotations · ${snapshot ? `${snapshot.ok}/${snapshot.total}` : '—'}`} ton="froid">
        {snapshot === null ? (
          <p className="j-body">
            Aucun relevé encore reçu. Boris interroge les marchés à chaque cycle ; le premier
            arrive au démarrage.
          </p>
        ) : (
          <>
            <div className="cot-grille">
              {core.map((q) => (
                <Cotation key={q.id} q={q} />
              ))}
            </div>
            <p className="vp-note j-dim">
              Relevé du {new Date(snapshot.fetchedAt).toLocaleString('fr-FR')}.
            </p>
          </>
        )}
      </Bloc>

      <Bloc titre={`Seuils surveillés · ${MARKET_THRESHOLDS.length}`} ton="froid">
        {MARKET_THRESHOLDS.map((t) => {
          const q = snapshot?.quotes.find((x) => x.id === t.quoteId)
          const franchi =
            q?.price != null && (t.direction === 'below' ? q.price < t.value : q.price > t.value)
          return (
            <div className={`vp-item${franchi ? ' g-crit' : ' vp-ok'}`} key={`${t.quoteId}-${t.value}`}>
              <div className="vp-t">
                <span className="vp-g">{t.direction === 'below' ? 'sous' : 'au-dessus'}</span>
                {t.label}
              </div>
              <div className="vp-m">
                seuil <b>{fmt(t.value)}</b>
                {q?.price != null && (
                  <>
                    {' · '}cours <b>{fmt(q.price)}</b>
                    {' · '}écart {ecart(q.price, t.value)}
                  </>
                )}
              </div>
            </div>
          )
        })}
        <p className="vp-note j-dim">
          Un seuil franchi rend le cycle critique. Franchi <b>pendant</b> le cycle il alerte ;
          déjà franchi au démarrage il se contente de surveiller — sans quoi Boris crierait
          chaque matin la même nouvelle.
        </p>
      </Bloc>

      {chocs.length > 0 && (
        <Bloc titre={`Chocs du dernier cycle · ${chocs.length}`} ton="chaud">
          {chocs.map((h) => (
            <div className={`vp-item ${h.severity === 'critical' ? 'g-crit' : 'g-hot'}`} key={h.label}>
              <div className="vp-t">
                <span className="vp-g">{h.severity === 'critical' ? 'critique' : 'surveillance'}</span>
                {h.label}
              </div>
              <div className="vp-m">{h.detail}</div>
            </div>
          ))}
        </Bloc>
      )}
    </div>
  )
}

function Cotation({ q }: { q: MarketQuote }) {
  if (q.error !== undefined) {
    return (
      <div className="cot cot-hs">
        <span className="cot-l">{q.label}</span>
        <span className="cot-e">indisponible</span>
      </div>
    )
  }

  const v = q.changePercent
  const sens = v === null ? '' : v > 0 ? ' up' : v < 0 ? ' dn' : ''

  return (
    <div className="cot">
      <span className="cot-l">{q.label}</span>
      <span className="cot-p">
        {q.price === null ? '—' : fmt(q.price)}
        {q.currency && <i>{q.currency}</i>}
      </span>
      <span className={`cot-v${sens}`}>
        {v === null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)} %`}
      </span>
    </div>
  )
}

function fmt(n: number): string {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: n < 100 ? 2 : 0 })
}

/** L'ecart au seuil dit mieux que le seuil seul a quelle distance on joue. */
function ecart(prix: number, seuil: number): string {
  const pct = ((prix - seuil) / seuil) * 100
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)} %`
}
