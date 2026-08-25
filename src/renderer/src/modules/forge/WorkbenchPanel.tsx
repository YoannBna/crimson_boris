import type { Change, Workbench } from '@shared/forge'
import { Card, Note, Alert } from '@/components/primitives'

export function WorkbenchPanel({
  bench,
  hasDeck,
  onDrop,
  onClear,
  onExport,
  exported,
  busy
}: {
  bench: Workbench | null
  hasDeck: boolean
  onDrop: (id: string) => void
  onClear: () => void
  onExport: () => void
  exported: string | null
  busy: string | null
}) {
  if (!bench || !hasDeck) {
    return (
      <Card full title="⚒ Etabli — plan de modification">
        <p className="hint">
          Ici s'accumulent les entrees et les sorties proposees par les recommandations, la
          recherche dans le pool et les directives ecrites. L'etabli tient le compte du format,
          chiffre le cout d'achat et la valeur liberee, et n'ecrit jamais sur ta liste
          d'origine : l'export produit un nouveau fichier.
        </p>
        <p className="hint">
          <b>Importe une liste</b> pour l'activer.
        </p>
      </Card>
    )
  }

  const adds = bench.changes.filter((c) => c.kind === 'add')
  const cuts = bench.changes.filter((c) => c.kind === 'cut')
  const cost = adds.reduce((n, c) => n + (c.card?.priceEur ?? 0), 0)
  const freed = cuts.reduce((n, c) => n + (c.card?.priceEur ?? 0), 0)

  return (
    <Card full title="⚒ Etabli — plan de modification">
      <div className="bench-head">
        <span className="bench-total">
          <b>{bench.baseTotal}</b> → <b className={bench.verdict.ok ? 'ok' : 'crit'}>{bench.projectedTotal}</b> / 100
        </span>
        <span className="bench-flow">
          <span className="up">+{adds.length}</span> entrees ·{' '}
          <span className="dn">−{cuts.length}</span> sorties
        </span>
        {adds.length + cuts.length > 0 && (
          <span className="bench-cost">
            achat <b>{cost.toFixed(2)} €</b> · libere <b>{freed.toFixed(2)} €</b>
          </span>
        )}
        <div className="bench-actions">
          <button className="btn ghost" onClick={onClear} disabled={Boolean(busy) || bench.changes.length === 0}>
            Vider
          </button>
          <button className="btn" onClick={onExport} disabled={Boolean(busy) || bench.changes.length === 0}>
            {busy ?? 'Exporter le plan'}
          </button>
        </div>
      </div>

      {bench.changes.length === 0 ? (
        <p className="hint">
          L'etabli est vide. Les recommandations, la recherche dans le pool et les directives
          ecrites y deposent leurs propositions ; rien n'est applique tant que tu n'exportes pas.
        </p>
      ) : (
        <>
          {!bench.verdict.ok && (
            <Alert heading="⚠ PLAN HORS FORMAT">{bench.verdict.message}</Alert>
          )}
          {bench.verdict.ok && <div className="bench-ok">✓ {bench.verdict.message}</div>}

          <div className="bench-cols">
            <Column title="Sorties" list={cuts} onDrop={onDrop} tone="cut" />
            <Column title="Entrees" list={adds} onDrop={onDrop} tone="add" />
          </div>
        </>
      )}

      {exported && (
        <Note>
          Plan ecrit dans <b>{exported}</b>. Ton export d'origine n'a pas ete touche — reimporte
          ce fichier pour travailler sur la nouvelle liste.
        </Note>
      )}
    </Card>
  )
}

function Column({
  title,
  list,
  onDrop,
  tone
}: {
  title: string
  list: Change[]
  onDrop: (id: string) => void
  tone: 'add' | 'cut'
}) {
  return (
    <div className={`bench-col bc-${tone}`}>
      <div className="bench-col-h">
        {title} <b>{list.length}</b>
      </div>
      {list.length === 0 ? (
        <div className="bench-empty">—</div>
      ) : (
        list.map((c) => (
          <div className="bench-row" key={c.id}>
            {c.card?.imageSmall && <img className="bench-img" src={c.card.imageSmall} alt="" loading="lazy" />}
            <div className="bench-b">
              <div className="bench-n">
                {c.cardName}
                {c.card?.manaCost && <span className="bench-cost-sym">{c.card.manaCost}</span>}
              </div>
              <div className="bench-w">{c.because}</div>
            </div>
            <div className="bench-p">
              {c.card?.priceEur !== null && c.card ? `${c.card.priceEur?.toFixed(2)} €` : '— €'}
            </div>
            <button className="bench-x" onClick={() => onDrop(c.id)} title="Retirer de l'etabli">
              ×
            </button>
          </div>
        ))
      )}
    </div>
  )
}
