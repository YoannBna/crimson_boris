import { useCallback, useEffect, useState } from 'react'
import type {
  Advice,
  Change,
  DirectivePlan,
  PoolQuery,
  PoolResult,
  Workbench
} from '@shared/forge'
import { hasBridge } from './useBoris'

export interface ForgeState {
  bench: Workbench | null
  advice: Advice[]
  pool: PoolResult | null
  plan: DirectivePlan | null
  busy: string | null
  error: string | null
  exported: string | null
  /** Compte rendu de la derniere application de plan */
  applied: string | null
}

export function useForge(deckKey: string | null) {
  const [state, setState] = useState<ForgeState>({
    bench: null,
    advice: [],
    pool: null,
    plan: null,
    busy: null,
    error: null,
    exported: null,
    applied: null
  })

  // L'atelier se recharge quand le deck change d'identite.
  useEffect(() => {
    if (!hasBridge || !deckKey) return
    void (async () => {
      const [bench, advice] = await Promise.all([
        window.boris.forge.getWorkbench(),
        window.boris.forge.advise()
      ])
      setState((s) => ({ ...s, bench, advice }))
    })()
  }, [deckKey])

  const guard = useCallback(
    async (label: string, fn: () => Promise<Partial<ForgeState>>) => {
      setState((s) => ({ ...s, busy: label, error: null }))
      try {
        const patch = await fn()
        setState((s) => ({ ...s, ...patch, busy: null }))
      } catch (err) {
        setState((s) => ({
          ...s,
          busy: null,
          error: err instanceof Error ? err.message : String(err)
        }))
      }
    },
    []
  )

  const searchPool = useCallback(
    (q: PoolQuery) =>
      guard('Interrogation du pool…', async () => ({
        pool: await window.boris.forge.searchPool(q)
      })),
    [guard]
  )

  const planDirectives = useCallback(
    (text: string) =>
      guard('Lecture des directives…', async () => ({
        plan: await window.boris.forge.planDirectives(text)
      })),
    [guard]
  )

  /** Verse un lot de modifications a l'etabli, une par une. */
  const commit = useCallback(
    (list: Omit<Change, 'id'>[]) =>
      guard('Mise a l’etabli…', async () => {
        let bench: Workbench | null = null
        for (const c of list) bench = await window.boris.forge.addChange(c)
        return { bench, exported: null }
      }),
    [guard]
  )

  const drop = useCallback(
    (id: string) =>
      guard('Retrait…', async () => ({
        bench: await window.boris.forge.dropChange(id),
        exported: null
      })),
    [guard]
  )

  const clear = useCallback(
    () =>
      guard('Remise a zero…', async () => ({
        bench: await window.boris.forge.clearChanges(),
        plan: null,
        exported: null
      })),
    [guard]
  )

  /**
   * Applique le plan au deck et recharge l'etabli.
   * Le deck lui-meme est relu par le composant parent : c'est lui qui
   * detient l'etat du deck courant.
   */
  const applyPlan = useCallback(
    (onDeckChanged?: () => void) =>
      guard('Application au deck…', async () => {
        const res = await window.boris.forge.applyPlan()
        const bench = await window.boris.forge.getWorkbench()
        onDeckChanged?.()
        return {
          bench,
          exported: null,
          plan: null,
          applied:
            `Plan applique : ${res.removed} sortie(s), ${res.added} entree(s). ` +
            `Le deck compte ${res.cards} cartes — version ${res.versionId} enregistree.`
        }
      }),
    [guard]
  )

  const exportPlan = useCallback(
    () =>
      guard('Ecriture du fichier…', async () => {
        const res = await window.boris.forge.exportPlan()
        return { exported: res.path }
      }),
    [guard]
  )

  const refreshAdvice = useCallback(
    () =>
      guard('Analyse de la liste…', async () => ({
        advice: await window.boris.forge.advise()
      })),
    [guard]
  )

  return {
    state,
    searchPool,
    planDirectives,
    commit,
    drop,
    clear,
    exportPlan,
    applyPlan,
    refreshAdvice
  }
}
