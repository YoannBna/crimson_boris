import type { StyleFind } from '@shared/mtg'
import { Card, Note } from '@/components/primitives'

/** Traduit les attributs d'impression en langage lisible. */
function treatments(p: StyleFind['candidates'][number]): string {
  const parts: string[] = []
  if (p.borderColor === 'borderless') parts.push('sans bordure')
  if (p.fullArt) parts.push('pleine illustration')
  for (const fx of p.frameEffects) {
    parts.push(
      fx === 'showcase'
        ? 'vitrine'
        : fx === 'extendedart'
          ? 'illustration etendue'
          : fx === 'etched'
            ? 'grave'
            : fx
    )
  }
  if (p.promo && parts.length === 0) parts.push('promo')
  return parts.join(' · ') || 'standard'
}

export function StylePanel({
  styles,
  onLoad,
  busy
}: {
  styles: StyleFind[]
  onLoad: () => void
  busy: string | null
}) {
  return (
    <Card full title="◈ Variantes graphiques — stylees et bon marche">
      {styles.length === 0 ? (
        <>
          <p className="hint">
            Boris parcourt toutes les impressions de tes cartes maitresses et ne retient que
            celles dont le traitement graphique est recherche et dont le prix reste sous six
            euros.
          </p>
          <button className="btn" onClick={onLoad} disabled={Boolean(busy)}>
            {busy ?? 'Chercher les variantes'}
          </button>
        </>
      ) : (
        <>
          {styles.map((s) => (
            <div className="style-block" key={s.cardName}>
              <div className="style-h">
                <span className="style-n">{s.cardName}</span>
                <span className="style-c">
                  moins chere listee :{' '}
                  {s.current?.priceEur !== null && s.current
                    ? `${s.current.priceEur?.toFixed(2)} € (${s.current.setCode})`
                    : '—'}
                </span>
              </div>
              <div className="style-grid">
                {s.candidates.map((p) => (
                  <div className="print" key={p.scryfallId}>
                    {p.imageNormal && (
                      <img className="print-img" src={p.imageNormal} alt="" loading="lazy" />
                    )}
                    <div className="print-meta">
                      <b>{p.priceEur !== null ? `${p.priceEur.toFixed(2)} €` : '— €'}</b>
                      <span className="print-set">
                        {p.setCode} {p.collectorNumber}
                      </span>
                      <span className="print-fx">{treatments(p)}</span>
                      {p.artist && <span className="print-artist">{p.artist}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <Note>
            Scryfall ne publie aucune note esthetique : le classement est deduit des
            attributs d'impression — sans bordure, pleine illustration, cadre vitrine.
            Les prix sont ceux de Cardmarket, actualises quotidiennement et{' '}
            <b>indicatifs</b>.
          </Note>
        </>
      )}
    </Card>
  )
}
