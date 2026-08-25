import type { TriggerSource } from '@shared/types'

/**
 * Cycle regulier. Reprogramme apres chaque execution plutot qu'a intervalle
 * fixe : un cycle declenche par un reveil repousse d'autant le suivant,
 * ce qui evite deux passes coup sur coup.
 */
export class Scheduler {
  private timer: NodeJS.Timeout | null = null
  private nextAt: Date | null = null

  constructor(private readonly run: (trigger: TriggerSource) => void) {}

  /** (Re)arme le prochain cycle. */
  arm(intervalMinutes: number): void {
    this.disarm()
    const ms = Math.max(1, intervalMinutes) * 60_000
    this.nextAt = new Date(Date.now() + ms)
    this.timer = setTimeout(() => {
      this.timer = null
      this.run('interval')
    }, ms)
  }

  disarm(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.nextAt = null
  }

  get next(): string | null {
    return this.nextAt?.toISOString() ?? null
  }
}
