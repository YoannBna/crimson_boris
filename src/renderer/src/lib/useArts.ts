import { useCallback, useEffect, useState } from 'react'
import type { ChosenArt, Printing } from '@shared/mtg'
import { hasBridge } from './useBoris'

/*
 * Illustrations retenues.
 *
 * L'etat vit au-dessus des cartes plutot que dans chacune : le badge
 * pinceau doit apparaitre au meme instant sur la ligne du deck, sur
 * l'apercu au survol et dans la vue d'inspection.
 */
export function useArts() {
  const [arts, setArts] = useState<Record<string, ChosenArt>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!hasBridge) return
    void window.boris.mtg.getArts().then(setArts)
  }, [])

  const choisir = useCallback(async (cardName: string, p: Printing) => {
    setBusy(true)
    try {
      setArts(
        await window.boris.mtg.chooseArt({
          cardName,
          scryfallId: p.scryfallId,
          setCode: p.setCode,
          setName: p.setName,
          collectorNumber: p.collectorNumber,
          artist: p.artist,
          imageNormal: p.imageNormal,
          priceEur: p.priceEur
        })
      )
    } finally {
      setBusy(false)
    }
  }, [])

  const retirer = useCallback(async (cardName: string) => {
    setBusy(true)
    try {
      setArts(await window.boris.mtg.clearArt(cardName))
    } finally {
      setBusy(false)
    }
  }, [])

  return { arts, busy, choisir, retirer }
}
