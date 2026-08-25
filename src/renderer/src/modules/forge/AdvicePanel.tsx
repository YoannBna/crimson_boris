import type { Advice, AdviceGrade, Change } from '@shared/forge'
import { Card, Note } from '@/components/primitives'

const GRADE_CLS: Record<AdviceGrade, string> = {
  critique: 'g-crit',
  important: 'g-hot',
  mineur: 'g-warm'
}

export function AdvicePanel({
  advice,
  hasDeck,
  onDirective,
  onRefresh,
  busy
}: {
  advice: Advice[]
  hasDeck: boolean
  onDirective: (text: string) => void
  onRefresh: () => void
  busy: string | null
}) {
  return (
    <Card full title="◈ Recommandations — lecture de la composition">
      {advice.length === 0 ? (
        <>
          <p className="hint">
            Boris lit la composition et signale ce qui cloche : depassement de format, cartes
            hors identite couleur, doublons, terrains qui entrent engages, courbe trop haute,
            categories sous-dotees, et — une fois une campagne jouee — les cartes qui dorment
            en main. Chaque constat sait ecrire la directive qui le corrige.
          </p>
          <button className="btn" onClick={onRefresh} disabled={Boolean(busy) || !hasDeck}>
            {busy ?? (hasDeck ? 'Analyser la liste' : 'Importe une liste d’abord')}
          </button>
        </>
      ) : (
        <>
          {advice.map((a) => (
            <div className={`finding ${GRADE_CLS[a.grade]}`} key={`${a.id}-${a.title}`}>
              <div className="finding-h">
                <span className="finding-g">{a.grade}</span>
                <span className="finding-t">{a.title}</span>
                {a.proposal && (
                  <button
                    className="advice-act"
                    onClick={() => onDirective(toDirective(a))}
                    title="Ecrit la directive correspondante"
                  >
                    {a.proposal.kind === 'add' ? '+ ' : '− '}
                    {a.proposal.quantity}
                  </button>
                )}
              </div>
              <div className="finding-m">{a.measure}</div>
              <div className="finding-r">{a.reading}</div>
              {a.cards.length > 0 && (
                <div className="advice-cards">
                  {a.cards.slice(0, 10).map((n) => (
                    <span className="advice-card" key={n}>
                      {n}
                    </span>
                  ))}
                  {a.cards.length > 10 && (
                    <span className="advice-more">+{a.cards.length - 10}</span>
                  )}
                </div>
              )}
            </div>
          ))}
          <button className="btn ghost" onClick={onRefresh} disabled={Boolean(busy)}>
            {busy ?? 'Relire la liste'}
          </button>
        </>
      )}

      <Note>
        Analyse <b>statique</b> : elle lit ce que la liste CONTIENT. Le banc d'essai, lui, mesure
        ce qu'elle PRODUIT en jeu. Les deux se completent — une liste peut etre irreprochable sur
        le papier et s'effondrer en partie. Le bouton de chaque constat ecrit la directive
        correspondante dans l'atelier ; il ne l'applique pas.
      </Note>
    </Card>
  )
}

/** Traduit une proposition en directive ecrite, que l'operateur peut relire et amender. */
function toDirective(a: Advice): string {
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

export type { Change }
