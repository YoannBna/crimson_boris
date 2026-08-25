import { useCallback, useEffect, useState } from 'react'
import type {
  ResolvedDeck,
  SimConfig,
  SimResult,
  StyleFind,
  Suggestion
} from '@shared/mtg'
import { hasBridge } from './useBoris'

export interface MtgState {
  deck: ResolvedDeck | null
  run: SimResult | null
  suggestions: Record<string, Suggestion[]>
  styles: StyleFind[]
  busy: string | null
  error: string | null
}

export function useMtg() {
  const [state, setState] = useState<MtgState>({
    deck: null,
    run: null,
    suggestions: {},
    styles: [],
    busy: null,
    error: null
  })

  useEffect(() => {
    if (!hasBridge) return
    void (async () => {
      const [deck, run] = await Promise.all([
        window.boris.mtg.getDeck(),
        window.boris.mtg.getLastRun()
      ])
      setState((s) => ({ ...s, deck, run }))
    })()
  }, [])

  /** Enveloppe commune : un seul travail a la fois, erreurs remontees telles quelles. */
  const guard = useCallback(
    async (label: string, fn: () => Promise<Partial<MtgState>>) => {
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

  const importFolder = useCallback(
    () =>
      guard('Lecture du dossier decks/…', async () => {
        const deck = await window.boris.mtg.importFromFolder()
        if (!deck) {
          throw new Error(
            `Aucun fichier .txt ou .dec dans ${await window.boris.mtg.decksDir()}`
          )
        }
        return { deck, run: null, suggestions: {}, styles: [] }
      }),
    [guard]
  )

  const importDialog = useCallback(
    () =>
      guard('Import du fichier…', async () => {
        const deck = await window.boris.mtg.importDialog()
        return deck ? { deck, run: null, suggestions: {}, styles: [] } : {}
      }),
    [guard]
  )

  const runSim = useCallback(
    (config: Partial<SimConfig>) =>
      guard('Campagne en cours…', async () => ({
        run: await window.boris.mtg.runSim(config),
        suggestions: {}
      })),
    [guard]
  )

  const loadSuggestions = useCallback(
    () =>
      guard('Interrogation de Scryfall…', async () => ({
        suggestions: await window.boris.mtg.getSuggestions()
      })),
    [guard]
  )

  const loadStyles = useCallback(
    () =>
      guard('Recherche des impressions…', async () => ({
        styles: await window.boris.mtg.getStyleUpgrades()
      })),
    [guard]
  )

  return { state, importFolder, importDialog, runSim, loadSuggestions, loadStyles }
}
