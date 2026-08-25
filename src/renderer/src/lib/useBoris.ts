import { useCallback, useEffect, useState } from 'react'
import type { CoreStatus, MarketSnapshot, TaskState } from '@shared/types'

/** true lorsque le renderer tourne dans la coquille Electron. */
export const hasBridge = typeof window !== 'undefined' && Boolean(window.boris)

export function useCoreStatus(): CoreStatus | null {
  const [status, setStatus] = useState<CoreStatus | null>(null)
  useEffect(() => {
    if (!hasBridge) return
    void window.boris.getStatus().then(setStatus)
    return window.boris.onStatus(setStatus)
  }, [])
  return status
}

export function useMarkets(): MarketSnapshot | null {
  const [snap, setSnap] = useState<MarketSnapshot | null>(null)
  useEffect(() => {
    if (!hasBridge) return
    void window.boris.getMarkets().then(setSnap)
    return window.boris.onMarkets(setSnap)
  }, [])
  return snap
}

/**
 * Etat des taches. Persiste par le main process, afin que Boris puisse
 * evaluer les echeances meme lorsque aucune fenetre n'est ouverte.
 * Hors coquille, l'etat reste en memoire pour permettre l'inspection.
 */
export function useTasks(): [Set<string>, (id: string) => void] {
  const [done, setDone] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!hasBridge) return
    void window.boris.getTasks().then((rows) => setDone(toSet(rows)))
  }, [])

  const toggle = useCallback(
    (id: string) => {
      const next = !done.has(id)
      setDone((prev) => {
        const s = new Set(prev)
        if (next) s.add(id)
        else s.delete(id)
        return s
      })
      if (hasBridge) {
        void window.boris.setTaskDone(id, next).then((rows) => setDone(toSet(rows)))
      }
    },
    [done]
  )

  return [done, toggle]
}

function toSet(rows: TaskState[]): Set<string> {
  return new Set(rows.filter((r) => r.done).map((r) => r.id))
}
