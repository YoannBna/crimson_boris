import { useEffect, useRef, useState } from 'react'
import type { ResolvedDeck, SimResult, Suggestion } from '@shared/mtg'
import type { Advice, Change, DirectivePlan, PoolResult, Workbench } from '@shared/forge'
import { Mana } from './Mana'
import { Attente, Bloc } from './VoletAnalyse'

type Source = 'auto' | 'recherche' | 'directives'

/* ============================================================
   Volet CONSTRUCTION — deux entrees, une sortie
   ============================================================ */

/**
 * Trois facons d'alimenter l'etabli : les propositions du moteur, une
 * recherche libre dans le pool, des directives ecrites. Une seule facon
 * d'en sortir : l'etabli, ancre en bas du volet.
 *
 * L'etabli reste visible quelle que soit la source, parce que c'est lui
 * qui porte le compte du format. Le cacher derriere un onglet laisserait
 * composer un plan a 104 cartes sans jamais le voir.
 */
export function VoletConstruction({
  deck,
  run,
  advice,
  suggestions,
  pool,
  plan,
  bench,
  busy,
  exported,
  applied,
  onSuggestions,
  onSearch,
  onPlan,
  onCommit,
  onDrop,
  onClear,
  onExport,
  onApply
}: {
  deck: ResolvedDeck | null
  run: SimResult | null
  advice: Advice[]
  suggestions: Record<string, Suggestion[]>
  pool: PoolResult | null
  plan: DirectivePlan | null
  bench: Workbench | null
  busy: string | null
  exported: string | null
  applied: string | null
  onSuggestions: () => void
  onSearch: (text: string, legalOnly: boolean, maxPrice?: number) => void
  onPlan: (text: string) => void
  onCommit: (list: Omit<Change, 'id'>[]) => void
  onDrop: (id: string) => void
  onClear: () => void
  onExport: () => void
  onApply: () => void
}) {
  const [source, setSource] = useState<Source>('auto')
  const [texte, setTexte] = useState('')
  const [requete, setRequete] = useState('')
  const [legalOnly, setLegalOnly] = useState(true)
  const [maxPrix, setMaxPrix] = useState('')
  const zone = useRef<HTMLTextAreaElement>(null)

  /** Un constat qui sait s'ecrire en directive ouvre l'onglet ou on la relit. */
  const versDirective = (t: string): void => {
    setTexte((prev) => (prev.trim() === '' ? t : `${prev}\n${t}`))
    setSource('directives')
  }

  useEffect(() => {
    if (source === 'directives') zone.current?.focus()
  }, [source])

  if (!deck) return <Attente texte="Charge une liste : la construction travaille sur un deck existant." />

  return (
    <div className="vp vc">
      <div className="vc-onglets">
        {(['auto', 'recherche', 'directives'] as Source[]).map((s) => (
          <button
            key={s}
            className={`vc-onglet${source === s ? ' on' : ''}`}
            onClick={() => setSource(s)}
          >
            {s === 'auto' ? 'Propositions' : s === 'recherche' ? 'Recherche' : 'Directives'}
          </button>
        ))}
      </div>

      <div className="vc-source">
        {source === 'auto' && (
          <Auto
            advice={advice}
            suggestions={suggestions}
            run={run}
            busy={busy}
            onSuggestions={onSuggestions}
            onCommit={onCommit}
            onDirective={versDirective}
          />
        )}

        {source === 'recherche' && (
          <Bloc titre="Recherche dans le pool" ton="froid">
            <div className="vc-form">
              <input
                placeholder="ex. t:instant o:destroy  —  syntaxe Scryfall"
                value={requete}
                onChange={(e) => setRequete(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onSearch(requete, legalOnly, maxPrix === '' ? undefined : Number(maxPrix))
                  }
                }}
              />
              <div className="vc-form-l">
                <label className="vc-check">
                  <input
                    type="checkbox"
                    checked={legalOnly}
                    onChange={(e) => setLegalOnly(e.target.checked)}
                  />
                  <span>Identite du commandant</span>
                </label>
                <label className="vc-check">
                  <span>Prix max €</span>
                  <input
                    className="vc-prix"
                    type="number"
                    value={maxPrix}
                    onChange={(e) => setMaxPrix(e.target.value)}
                  />
                </label>
              </div>
              <button
                className="oct-btn"
                disabled={Boolean(busy) || requete.trim() === ''}
                onClick={() =>
                  onSearch(requete, legalOnly, maxPrix === '' ? undefined : Number(maxPrix))
                }
              >
                {busy ?? 'Interroger Scryfall'}
              </button>
            </div>

            {pool && (
              <>
                <div className="j-dim vc-scry">
                  {pool.cards.length} resultat(s){pool.truncated ? ' — tronque' : ''} ·{' '}
                  <code>{pool.scryfall}</code>
                </div>
                {pool.cards.map((c) => (
                  <Proposition
                    key={c.scryfallId}
                    nom={c.name}
                    cout={c.manaCost}
                    prix={c.priceEur}
                    raison={c.typeLine}
                    onAjouter={() =>
                      onCommit([
                        {
                          kind: 'add',
                          cardName: c.name,
                          card: c,
                          because: `recherche « ${pool.query} »`,
                          source: 'manuel'
                        }
                      ])
                    }
                  />
                ))}
              </>
            )}
          </Bloc>
        )}

        {source === 'directives' && (
          <Bloc titre="Directives ecrites" ton="froid">
            <textarea
              ref={zone}
              className="vc-zone"
              rows={6}
              placeholder={
                'ajoute 3 pioche budget<6\ncoupe les terrains qui entrent engages\nremplace Sol Ring par de la rampe'
              }
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
            />
            <button
              className="oct-btn"
              disabled={Boolean(busy) || texte.trim() === ''}
              onClick={() => onPlan(texte)}
            >
              {busy ?? 'Interpreter'}
            </button>

            {plan && (
              <div className="vc-plan">
                {plan.report.map((r, i) => (
                  <div className="vc-rapport" key={i}>
                    {r}
                  </div>
                ))}
                {plan.rejected.map((r, i) => (
                  <div className="vc-rejet" key={i}>
                    « {r.raw} » — {r.reason}
                  </div>
                ))}
                {plan.changes.length > 0 && (
                  <button
                    className="oct-btn oct-btn-warm"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      onCommit(
                        plan.changes.map((c) => ({
                          kind: c.kind,
                          cardName: c.cardName,
                          card: c.card,
                          because: c.because,
                          source: c.source
                        }))
                      )
                    }
                  >
                    Verser {plan.changes.length} modification(s) a l'etabli
                  </button>
                )}
              </div>
            )}
            <p className="vp-note j-dim">
              Une ligne non comprise n'est jamais avalee en silence : elle remonte telle quelle
              avec la raison du refus.
            </p>
          </Bloc>
        )}
      </div>

      <Etabli
        bench={bench}
        busy={busy}
        exported={exported}
        applied={applied}
        onDrop={onDrop}
        onClear={onClear}
        onExport={onExport}
        onApply={onApply}
      />
    </div>
  )
}

/* --- Propositions du moteur --------------------------------- */

function Auto({
  advice,
  suggestions,
  run,
  busy,
  onSuggestions,
  onCommit,
  onDirective
}: {
  advice: Advice[]
  suggestions: Record<string, Suggestion[]>
  run: SimResult | null
  busy: string | null
  onSuggestions: () => void
  onCommit: (list: Omit<Change, 'id'>[]) => void
  onDirective: (t: string) => void
}) {
  const avecPropositions = advice.filter((a) => a.proposal)

  return (
    <>
      <Bloc titre={`Remedes aux defauts de composition · ${avecPropositions.length}`} ton="chaud">
        {avecPropositions.length === 0 ? (
          <p className="j-body">Aucun constat statique n'appelle de modification.</p>
        ) : (
          avecPropositions.map((a) => (
            <div className="vp-item" key={`${a.id}-${a.title}`}>
              <div className="vp-t">
                <span className="vp-g">{a.grade}</span>
                {a.title}
                <button
                  className="vc-mini"
                  title="Ecrit la directive correspondante, que tu pourras relire"
                  onClick={() => onDirective(directiveDe(a))}
                >
                  {a.proposal?.kind === 'add' ? '+' : '−'}
                  {a.proposal?.quantity}
                </button>
              </div>
              <div className="vp-m">{a.measure}</div>
              {/* Les retraits nommes se versent carte par carte : c'est le
                  geste que l'operateur veut faire, et le seul qui ne
                  suppose rien a sa place. */}
              {a.proposal?.kind === 'cut' && a.cards.length > 0 && (
                <div className="vc-noms">
                  {a.cards.slice(0, 12).map((n) => (
                    <button
                      className="vc-nom"
                      key={n}
                      onClick={() =>
                        onCommit([
                          { kind: 'cut', cardName: n, card: null, because: a.title, source: 'recommandation' }
                        ])
                      }
                      title="Verser cette sortie a l'etabli"
                    >
                      − {n}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </Bloc>

      <Bloc titre="Cartes proposees par Scryfall" ton="chaud">
        {run === null ? (
          <p className="j-body">
            Les suggestions repondent aux constats de campagne. Lance une simulation d'abord :
            proposer des cartes sans savoir ce qui manque reviendrait a deviner.
          </p>
        ) : Object.keys(suggestions).length === 0 ? (
          <button className="oct-btn oct-btn-warm" disabled={Boolean(busy)} onClick={onSuggestions}>
            {busy ?? 'Chercher des cartes pour combler les failles'}
          </button>
        ) : (
          Object.entries(suggestions).map(([id, list]) => {
            const f = run.findings.find((x) => x.id === id)
            return (
              <div className="vc-lot" key={id}>
                <div className="vc-lot-t">{f?.title ?? id}</div>
                {list.map((s) => (
                  <Proposition
                    key={s.card.scryfallId}
                    nom={s.card.name}
                    cout={s.card.manaCost}
                    prix={s.card.priceEur}
                    raison={s.because}
                    note={s.score}
                    onAjouter={() =>
                      onCommit([
                        {
                          kind: 'add',
                          cardName: s.card.name,
                          card: s.card,
                          because: s.because,
                          source: 'recommandation'
                        }
                      ])
                    }
                  />
                ))}
              </div>
            )
          })
        )}
      </Bloc>
    </>
  )
}

function Proposition({
  nom,
  cout,
  prix,
  raison,
  note,
  onAjouter
}: {
  nom: string
  cout: string | null
  prix: number | null
  raison: string
  note?: number
  onAjouter: () => void
}) {
  return (
    <div className="vc-prop">
      <button className="vc-plus" onClick={onAjouter} title="Verser a l'etabli">
        +
      </button>
      <div className="vc-prop-b">
        <div className="vc-prop-n">
          {nom}
          <Mana cost={cout} />
          {note !== undefined && <span className="vc-note">{note}</span>}
        </div>
        <div className="vc-prop-w">{raison}</div>
      </div>
      <span className="vc-prop-p">{prix === null ? '—' : `${prix.toFixed(2)} €`}</span>
    </div>
  )
}

/* --- Etabli -------------------------------------------------- */

function Etabli({
  bench,
  busy,
  exported,
  applied,
  onDrop,
  onClear,
  onExport,
  onApply
}: {
  bench: Workbench | null
  busy: string | null
  exported: string | null
  applied: string | null
  onDrop: (id: string) => void
  onClear: () => void
  onExport: () => void
  onApply: () => void
}) {
  const adds = bench?.changes.filter((c) => c.kind === 'add') ?? []
  const cuts = bench?.changes.filter((c) => c.kind === 'cut') ?? []
  const achat = adds.reduce((n, c) => n + (c.card?.priceEur ?? 0), 0)
  const libere = cuts.reduce((n, c) => n + (c.card?.priceEur ?? 0), 0)
  const vide = adds.length + cuts.length === 0

  return (
    <div className="vc-etabli">
      <div className="vce-h">
        <span className="vce-t">Etabli</span>
        {bench && (
          <span className="vce-total">
            {bench.baseTotal} → <b className={bench.verdict.ok ? 'ok' : 'hs'}>{bench.projectedTotal}</b> / 100
          </span>
        )}
        <span className="vce-flux">
          <b className="up">+{adds.length}</b> / <b className="dn">−{cuts.length}</b>
        </span>
        {!vide && (
          <span className="vce-eur">
            achat {achat.toFixed(2)} € · libere {libere.toFixed(2)} €
          </span>
        )}
      </div>

      {vide ? (
        <p className="vce-vide j-dim">
          Rien en attente. Les propositions, la recherche et les directives deposent ici ; le deck
          ne change qu'a la validation.
        </p>
      ) : (
        <>
          <div className="vce-liste">
            {[...cuts, ...adds].map((c) => (
              <div className={`vce-row ${c.kind === 'add' ? 'r-add' : 'r-cut'}`} key={c.id}>
                <span className="vce-signe">{c.kind === 'add' ? '+' : '−'}</span>
                <span className="vce-n">{c.cardName}</span>
                <span className="vce-w">{c.because}</span>
                <button className="vce-x" onClick={() => onDrop(c.id)} title="Retirer du plan">
                  ×
                </button>
              </div>
            ))}
          </div>

          {bench && (
            <div className={`vce-verdict${bench.verdict.ok ? ' ok' : ''}`}>
              {bench.verdict.ok ? '✓ ' : '⚠ '}
              {bench.verdict.message}
            </div>
          )}
        </>
      )}

      <div className="vce-actions">
        <button className="oct-btn" onClick={onClear} disabled={Boolean(busy) || vide}>
          Vider
        </button>
        <button className="oct-btn" onClick={onExport} disabled={Boolean(busy) || vide}>
          Exporter
        </button>
        <button className="oct-btn oct-btn-warm" onClick={onApply} disabled={Boolean(busy) || vide}>
          {busy ?? 'Valider'}
        </button>
      </div>

      {applied && <div className="vce-ok">✓ {applied}</div>}
      {exported && <div className="vce-ok">Fichier ecrit : {exported}</div>}
    </div>
  )
}

/** Traduit une proposition en directive ecrite, relisible et amendable. */
function directiveDe(a: Advice): string {
  if (!a.proposal) return ''
  const { kind, target, quantity } = a.proposal
  if (kind === 'cut') {
    if (a.id === 'dead-weight-cut') return `coupe ${quantity} cartes qui dorment`
    if (a.id === 'tapped-lands') return 'retire les terrains qui entrent engages'
    if (a.cards.length > 0) return a.cards.slice(0, quantity).map((n) => `coupe ${n}`).join('\n')
    return `coupe ${quantity} cartes qui dorment`
  }
  return `ajoute ${quantity} ${target ?? 'pioche'} budget<6`
}
