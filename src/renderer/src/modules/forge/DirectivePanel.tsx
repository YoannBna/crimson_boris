import { useState } from 'react'
import type { Change, DirectivePlan } from '@shared/forge'
import { Card, Note, Alert } from '@/components/primitives'

const EXAMPLES = [
  'coupe 2 cartes qui dorment',
  'ajoute 3 pioche cmc<=2 budget<5',
  'ajoute 4 sources rouges budget<8',
  'remplace Ruinous Ultimatum par un wrath budget<10',
  'retire les terrains qui entrent engages'
]

export function DirectivePanel({
  plan,
  hasDeck,
  onPlan,
  onCommit,
  busy
}: {
  plan: DirectivePlan | null
  hasDeck: boolean
  onPlan: (text: string) => void
  onCommit: (list: Omit<Change, 'id'>[]) => void
  busy: string | null
}) {
  const [text, setText] = useState('')

  return (
    <Card full title="✎ Directives — restructuration dictee">
      <textarea
        className="dir-input"
        rows={6}
        spellCheck={false}
        placeholder={'Une directive par ligne.\n\n' + EXAMPLES.join('\n')}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="dir-bar">
        <button
          className="btn"
          onClick={() => onPlan(text)}
          disabled={Boolean(busy) || text.trim() === '' || !hasDeck}
        >
          {busy ?? (hasDeck ? 'Interpreter' : 'Importe une liste d’abord')}
        </button>
        <div className="dir-chips">
          {EXAMPLES.slice(0, 3).map((e) => (
            <button
              key={e}
              className="dir-chip"
              onClick={() => setText((t) => (t ? `${t}\n${e}` : e))}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {plan && (
        <>
          <div className="dir-report">
            {plan.report.map((line, i) => (
              <div className="dir-line" key={i}>
                {line}
              </div>
            ))}
          </div>

          {plan.rejected.length > 0 && (
            <Alert heading={`⚠ ${plan.rejected.length} LIGNE(S) NON COMPRISE(S)`}>
              {plan.rejected.map((r) => (
                <div key={r.raw} className="dir-reject">
                  « {r.raw} » — {r.reason}
                </div>
              ))}
            </Alert>
          )}

          {plan.changes.length > 0 && (
            <div className="dir-commit">
              <span>
                <b>{plan.changes.length}</b> modification(s) proposee(s) · total projete{' '}
                <b className={plan.projectedTotal === 100 ? 'ok' : 'crit'}>
                  {plan.projectedTotal} / 100
                </b>
              </span>
              <button
                className="btn"
                onClick={() => onCommit(plan.changes.map(({ id: _id, ...rest }) => rest))}
                disabled={Boolean(busy)}
              >
                Verser a l’etabli
              </button>
            </div>
          )}
        </>
      )}

      <Note>
        Boris lit une <b>grammaire fermee</b>, pas du langage libre : verbes{' '}
        <b>ajoute · coupe · retire · remplace</b>, categories{' '}
        <b>pioche, removal, wrath, ramp, exutoire, drain, jetons, anthem, recursion, protection,
        terrain, creature</b>, contraintes <b>cmc&lt;=N</b>, <b>budget&lt;N</b>, une couleur,{' '}
        <b>degages</b> ou <b>engages</b>. Toute ligne non comprise est signalee avec son motif —
        jamais devinee.
      </Note>
    </Card>
  )
}
