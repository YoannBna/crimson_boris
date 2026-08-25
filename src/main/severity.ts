import type {
  MarketSnapshot,
  Severity,
  SeverityHit,
  TriggerSource
} from '@shared/types'
import { TASK_DEFS } from '@shared/tasks'
import { MARKET_THRESHOLDS } from '@shared/thresholds'
import { doneIds } from './store/tasks'
import { previousPrice, wakeCycleToday } from './store/journal'

const WAKE_TRIGGERS: TriggerSource[] = ['resume', 'unlock', 'active', 'clock-jump']

/**
 * Evalue la gravite du cycle. Chaque regle est independante :
 * en ajouter une revient a pousser une entree dans `hits`.
 */
export function evaluate(input: {
  trigger: TriggerSource
  markets: MarketSnapshot | null
}): { severity: Severity; hits: SeverityHit[] } {
  const hits: SeverityHit[] = []
  const done = doneIds()

  /* --- 1 · Tache SANS DELAI non cloturee ------------------- */
  const overdue = TASK_DEFS.filter((t) => t.dueCls === 'due-now' && !done.has(t.id))
  if (overdue.length > 0) {
    hits.push({
      rule: 'task-overdue',
      label: `${overdue.length} action${overdue.length > 1 ? 's' : ''} sans delai en suspens`,
      detail: overdue.map((t) => t.label).join(' · '),
      severity: 'critical'
    })
  }

  /* --- 2 · Echeance qui bascule --------------------------- */
  const now = Date.now()
  const shifting = TASK_DEFS.filter((t) => {
    if (done.has(t.id) || !t.dueDate) return false
    if (t.dueCls === 'due-now') return false // deja couvert par la regle 1
    return new Date(t.dueDate).getTime() <= now
  })
  if (shifting.length > 0) {
    hits.push({
      rule: 'deadline-shift',
      label: `${shifting.length} echeance${shifting.length > 1 ? 's' : ''} atteinte${shifting.length > 1 ? 's' : ''}`,
      detail: shifting.map((t) => `${t.label} (${t.due})`).join(' · '),
      severity: 'critical'
    })
  }

  /* --- 3 · Choc de marche ---------------------------------
   * Un seuil FRANCHI pendant ce cycle est un evenement : critique.
   * Un seuil deja franchi au cycle precedent n'est qu'un etat : surveillance.
   * Sans cette distinction, Boris s'imposerait a l'ecran a chaque reveil
   * tant que le cours reste du mauvais cote du seuil.
   */
  if (markets_ok(input.markets)) {
    const at = input.markets.fetchedAt
    for (const th of MARKET_THRESHOLDS) {
      const q = input.markets.quotes.find((x) => x.id === th.quoteId)
      if (!q || q.price === null) continue

      const isBreached = (p: number): boolean =>
        th.direction === 'below' ? p < th.value : p > th.value

      if (!isBreached(q.price)) continue

      const prev = previousPrice(th.quoteId, at)
      // Premier releve connu : aucun historique, donc aucun franchissement prouvable.
      const crossed = prev !== null && !isBreached(prev)

      hits.push({
        rule: 'market-shock',
        label: crossed ? th.label : `${th.label} (seuil deja franchi)`,
        detail: `${q.label} a ${formatPrice(q.price)}${
          q.changePercent !== null ? ` (${signed(q.changePercent)} %)` : ''
        }${prev !== null ? ` · cycle precedent : ${formatPrice(prev)}` : ' · sans historique'}`,
        severity: crossed ? 'critical' : 'watch'
      })
    }
  }

  /* --- 4 · Premier reveil de la journee ------------------- */
  if (WAKE_TRIGGERS.includes(input.trigger) && !wakeCycleToday()) {
    hits.push({
      rule: 'first-wake',
      label: 'Premier reveil de la journee',
      detail: 'Point de situation initial — Boris ne se manifestera plus ainsi aujourd’hui.',
      severity: 'critical'
    })
  }

  const severity: Severity = hits.some((h) => h.severity === 'critical')
    ? 'critical'
    : hits.length > 0
      ? 'watch'
      : 'nominal'

  return { severity, hits }
}

function markets_ok(m: MarketSnapshot | null): m is MarketSnapshot {
  return m !== null && m.ok > 0
}

function formatPrice(n: number): string {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
}

function signed(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}`
}
