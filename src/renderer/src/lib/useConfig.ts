import { useCallback, useEffect, useState } from 'react'
import type { AppConfig } from '@shared/config'
import { hasBridge } from './useBoris'

/*
 * Configuration de l'operateur.
 *
 * Extrait de App.tsx pour que l'ancienne interface et la refonte lisent
 * le meme etat par le meme chemin. Deux lectures paralleles de la meme
 * base auraient fini par diverger sur ce qui est configure et ce qui ne
 * l'est pas.
 */
export function useConfig() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!hasBridge) return
    void window.boris.config.get().then(setConfig)
  }, [])

  const run = useCallback(async (fn: () => Promise<AppConfig | void>): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const next = await fn()
      if (next) setConfig(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [])

  return { config, busy, error, setConfig, run }
}
