import { useCallback, useEffect, useState } from 'react'
import type {
  Advice,
  Change,
  DeckVersion,
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
  /** Pile des versions du deck, la plus recente en tete */
  versions: DeckVersion[]
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
    applied: null,
    versions: []
  })

  // L'atelier se recharge quand le deck change d'identite.
  useEffect(() => {
    if (!hasBridge || !deckKey) return
    void (async () => {
      const [bench, advice, versions] = await Promise.all([
        window.boris.forge.getWorkbench(),
        window.boris.forge.advise(),
        window.boris.forge.history()
      ])
      setState((s) => ({ ...s, bench, advice, versions }))
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
        const [bench, versions] = await Promise.all([
          window.boris.forge.getWorkbench(),
          window.boris.forge.history()
        ])
        onDeckChanged?.()
        return {
          bench,
          versions,
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

  /**
   * Recharge une version du deck.
   *
   * La version choisie est recopiee en tete de pile plutot que restauree
   * en place : rien n'est efface, et l'on peut donc repartir dans les
   * deux sens. C'est aussi pourquoi l'etabli est vide au passage — un
   * plan ecrit pour une liste n'a pas de sens sur une autre.
   */
  const revertTo = useCallback(
    (versionId: number, onDeckChanged?: () => void) =>
      guard('Chargement de la version…', async () => {
        const versions = await window.boris.forge.revertTo(versionId)
        const [bench, advice] = await Promise.all([
          window.boris.forge.getWorkbench(),
          window.boris.forge.advise()
        ])
        onDeckChanged?.()
        return { versions, bench, advice, plan: null, exported: null, applied: null }
      }),
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
    refreshAdvice,
    revertTo
  }
}
