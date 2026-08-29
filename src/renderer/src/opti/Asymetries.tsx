import { useState } from 'react'
import type { MarketSnapshot } from '@shared/types'
import { ASYMMETRIES, AXIS_LABEL, type Axis } from '@/data/asymmetries'
import { Bloc } from '@/forge/VoletAnalyse'

/* ============================================================
   Asymetries radicales — dix positions de rupture
   ============================================================ */

/**
 * Le cours vient du releve, la these du fichier de donnees.
 *
 * Les deux ne sont jamais melanges a l'affichage : un chiffre releve et
 * une estimation ecrite a la main n'ont pas la meme valeur, et les
 * confondre reviendrait a faire passer un pari pour une mesure.
 */
export function Asymetries({ snapshot }: { snapshot: MarketSnapshot | null }) {
  const [ouverte, setOuverte] = useState<string | null>(null)

  return (
    <div className="vp">
      <Bloc titre={`Positions · ${ASYMMETRIES.length}`} ton="chaud">
        <p className="vp-note j-dim">
          Retenues sur quatre critères : rupture technique, présence dans l'actualité récente,
          importance géostratégique, potentiel de croissance du chiffre d'affaires. Le cours est
          relevé ; le reste est une thèse, pas une donnée.
        </p>

        <div className="asy-liste">
          {ASYMMETRIES.map((a) => {
            const q = snapshot?.quotes.find((x) => x.id === a.quoteId)
            const v = q?.changePercent ?? null
            const open = ouverte === a.quoteId
            return (
              <div className={`asy${open ? ' on' : ''}`} key={a.quoteId}>
                <button
                  className="asy-h"
                  onClick={() => setOuverte(open ? null : a.quoteId)}
                >
                  <span className="asy-tick">{a.ticker}</span>
                  <span className="asy-nom">{a.name}</span>
                  <span className={`asy-axe ax-${a.axis as Axis}`}>{AXIS_LABEL[a.axis]}</span>
                  <span className="asy-cours">
                    {q?.price == null
                      ? '—'
                      : q.price.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
                    {q?.currency && <i>{q.currency}</i>}
                  </span>
                  <span className={`asy-var${v === null ? '' : v > 0 ? ' up' : v < 0 ? ' dn' : ''}`}>
                    {v === null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)} %`}
                  </span>
                  <span className="asy-chev">{open ? '▾' : '▸'}</span>
                </button>

                {open && (
                  <div className="asy-corps">
                    <Ligne t="Rupture" v={a.rupture} />
                    <Ligne t="Réseau" v={a.network} />
                    <Ligne t="Impact estimé" v={a.impact} />
                    <Ligne t="Ce qui invaliderait" v={a.risk} ton="risque" />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <p className="jv-legal">
          Données de marché indicatives. Les thèses ci-dessus sont des paris écrits à la main,
          pas des analyses : aucune recommandation d'investissement.
        </p>
      </Bloc>
    </div>
  )
}

function Ligne({ t, v, ton }: { t: string; v: string; ton?: 'risque' }) {
  return (
    <div className={`asy-ligne${ton === 'risque' ? ' risque' : ''}`}>
      <span className="asy-lt">{t}</span>
      <span className="asy-lv">{v}</span>
    </div>
  )
}
