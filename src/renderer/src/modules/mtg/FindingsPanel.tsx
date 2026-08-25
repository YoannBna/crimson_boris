import type { Finding, FindingGrade, SimResult, Suggestion } from '@shared/mtg'
import { Card, Note } from '@/components/primitives'

const GRADE_CLS: Record<FindingGrade, string> = {
  critique: 'g-crit',
  desequilibre: 'g-hot',
  tension: 'g-warm',
  nominal: 'g-ok'
}

export function FindingsPanel({
  run,
  suggestions,
  onLoadSuggestions,
  busy
}: {
  run: SimResult
  suggestions: Record<string, Suggestion[]>
  onLoadSuggestions: () => void
  busy: string | null
}) {
  const actionable = run.findings.filter((f) => f.grade !== 'nominal')
  const hasSuggestions = Object.keys(suggestions).length > 0

  return (
    <Card full title="⚠ Problemes recurrents — lecture de la campagne">
      <div className="run-meta">
        <span>
          <b>{run.config.games}</b> parties
        </span>
        <span>
          <b>{run.config.opponents === 1 ? 'Duel' : 'Table a quatre'}</b>
        </span>
        <span>
          jusqu'au tour <b>{run.config.maxTurns}</b>
        </span>
        <span>
          graine <b>{run.config.seed}</b>
        </span>
        <span>{new Date(run.runAt).toLocaleString('fr-FR')}</span>
      </div>

      {run.findings.map((f) => (
        <FindingRow key={f.id} finding={f} suggestions={suggestions[f.id] ?? []} />
      ))}

      {actionable.length > 0 && !hasSuggestions && (
        <button className="btn" onClick={onLoadSuggestions} disabled={Boolean(busy)}>
          {busy ?? 'Demander des correctifs a Scryfall'}
        </button>
      )}

      <Note>
        Une meme graine rejoue exactement la meme campagne : change une carte, relance, et
        l'ecart mesure n'est imputable qu'a ta modification. Les capacites declenchees ne
        sont pas resolues — le moteur mesure des tendances, il n'arbitre pas une carte isolee.
      </Note>
    </Card>
  )
}

function FindingRow({ finding, suggestions }: { finding: Finding; suggestions: Suggestion[] }) {
  return (
    <div className={`finding ${GRADE_CLS[finding.grade]}`}>
      <div className="finding-h">
        <span className="finding-g">{finding.grade}</span>
        <span className="finding-t">{finding.title}</span>
      </div>
      <div className="finding-m">{finding.measure}</div>
      <div className="finding-r">{finding.reading}</div>

      {suggestions.length > 0 && (
        <div className="sugg">
          {suggestions.map((s) => (
            <div className="sugg-row" key={s.card.scryfallId}>
              {s.card.imageSmall && (
                <img className="sugg-img" src={s.card.imageSmall} alt="" loading="lazy" />
              )}
              <div className="sugg-b">
                <div className="sugg-n">
                  {s.card.name}
                  <span className="sugg-cost">{s.card.manaCost ?? ''}</span>
                </div>
                <div className="sugg-t">{s.card.typeLine}</div>
                <div className="sugg-w">{s.because}</div>
              </div>
              <div className="sugg-p">
                <b>{s.card.priceEur !== null ? `${s.card.priceEur.toFixed(2)} €` : '— €'}</b>
                <i>score {s.score}</i>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
