import { net } from 'electron'

/**
 * File d'attente sequentielle avec delai minimal entre deux requetes.
 * Un fournisseur = une file. Scryfall exige 50-100 ms entre appels ;
 * Yahoo n'a pas de regle publiee mais ne supporte pas les rafales.
 */
export class RequestQueue {
  private chain: Promise<unknown> = Promise.resolve()
  private lastAt = 0

  constructor(
    private readonly minDelayMs: number,
    private readonly userAgent: string,
    private readonly timeoutMs = 12_000
  ) {}

  /** Serialise l'appel derriere les precedents et respecte le delai minimal. */
  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(async () => {
      const wait = this.minDelayMs - (Date.now() - this.lastAt)
      if (wait > 0) await sleep(wait)
      try {
        return await fn()
      } finally {
        this.lastAt = Date.now()
      }
    })
    // La file ne doit jamais se rompre sur un echec isole.
    this.chain = run.catch(() => undefined)
    return run as Promise<T>
  }

  getJson<T>(url: string, accept = 'application/json'): Promise<T> {
    return this.enqueue(async () => {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), this.timeoutMs)
      try {
        const res = await net.fetch(url, {
          signal: ctrl.signal,
          headers: { 'User-Agent': this.userAgent, Accept: accept }
        })
        if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`)
        return (await res.json()) as T
      } finally {
        clearTimeout(timer)
      }
    })
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
