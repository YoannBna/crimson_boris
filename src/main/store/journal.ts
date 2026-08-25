import type { Severity, TriggerSource } from '@shared/types'
import { getDb } from './db'

export function logCycle(entry: {
  startedAt: string
  trigger: TriggerSource
  durationMs: number
  severity: Severity
  revealed: boolean
  fingerprint: string
}): void {
  getDb()
    .prepare(
      'INSERT INTO cycles (started_at, trigger, duration_ms, severity, revealed, fingerprint) ' +
        'VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(
      entry.startedAt,
      entry.trigger,
      entry.durationMs,
      entry.severity,
      entry.revealed ? 1 : 0,
      entry.fingerprint
    )
}

/**
 * Boris s'est-il deja impose a l'ecran pour EXACTEMENT ces memes signaux,
 * il y a moins de `withinMinutes` ?
 *
 * Une tache sans delai non cloturee est un etat durable, pas un evenement :
 * sans ce garde-fou, chaque sortie de veille rouvrirait la fenetre tant que
 * la case n'est pas cochee. La gravite reste affichee et la pastille de la
 * barre de menus reste allumee — seule l'irruption est retenue.
 */
export function alreadyRevealedFor(fingerprint: string, withinMinutes: number): boolean {
  if (fingerprint === '') return false
  const since = new Date(Date.now() - withinMinutes * 60_000).toISOString()
  const row = getDb()
    .prepare(
      'SELECT COUNT(*) AS n FROM cycles WHERE revealed = 1 AND fingerprint = ? AND started_at >= ?'
    )
    .get(fingerprint, since) as { n: number }
  return row.n > 0
}

/**
 * Un cycle declenche par un reveil a-t-il deja eu lieu aujourd'hui ?
 * Sert a n'honorer la regle `first-wake` qu'une fois par jour — et a
 * l'acquitter meme lorsque Boris n'a pas eu le droit de s'imposer a l'ecran.
 */
export function wakeCycleToday(): boolean {
  const row = getDb()
    .prepare(
      "SELECT COUNT(*) AS n FROM cycles " +
        "WHERE started_at >= ? AND trigger IN ('resume','unlock','active','clock-jump')"
    )
    .get(startOfLocalDay()) as { n: number }
  return row.n > 0
}

export function startOfLocalDay(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function recordQuote(quoteId: string, fetchedAt: string, price: number | null, changePct: number | null): void {
  getDb()
    .prepare(
      'INSERT OR REPLACE INTO quotes (quote_id, fetched_at, price, change_pct) VALUES (?, ?, ?, ?)'
    )
    .run(quoteId, fetchedAt, price, changePct)
}

/**
 * Dernier cours releve strictement avant `beforeIso`.
 * Sert a distinguer un franchissement de seuil — qui est un evenement —
 * d'un seuil deja franchi, qui n'est qu'un etat.
 */
export function previousPrice(quoteId: string, beforeIso: string): number | null {
  const row = getDb()
    .prepare(
      'SELECT price FROM quotes WHERE quote_id = ? AND fetched_at < ? AND price IS NOT NULL ' +
        'ORDER BY fetched_at DESC LIMIT 1'
    )
    .get(quoteId, beforeIso) as { price: number } | undefined
  return row?.price ?? null
}
