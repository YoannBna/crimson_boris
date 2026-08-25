import { useEffect, useState } from 'react'
import { Card, Alert } from '@/components/primitives'
import { hasBridge } from '@/lib/useBoris'

export function ImportPanel({
  onFolder,
  onDialog,
  busy,
  error,
  hasDeck
}: {
  onFolder: () => void
  onDialog: () => void
  busy: string | null
  error: string | null
  hasDeck: boolean
}) {
  const [dir, setDir] = useState<string | null>(null)

  useEffect(() => {
    if (!hasBridge) return
    void window.boris.mtg.decksDir().then(setDir)
  }, [])

  return (
    <Card full title="⇩ Import — liste de cartes">
      <div className="import-row">
        <button className="btn" onClick={onDialog} disabled={Boolean(busy)}>
          {busy ?? 'Choisir un fichier'}
        </button>
        <button
          className="btn ghost"
          onClick={onFolder}
          disabled={Boolean(busy)}
          title={dir ?? undefined}
        >
          Lire le dossier d’accueil
        </button>
        <span className="hint">
          Archidekt · Moxfield · MTGO (.dec). Chaque nom est resolu sur Scryfall pour
          obtenir cout, type, texte, illustration et prix.
        </span>
      </div>

      {dir && (
        <div className="import-path">
          Dossier d’accueil : <code>{dir}</code>
        </div>
      )}

      {error && <Alert heading="⚠ IMPORT INTERROMPU">{error}</Alert>}

      {!hasDeck && !error && (
        <div className="standby">
          <div className="g">◈</div>
          <div className="m">AUCUN DECK CHARGE</div>
          <div className="s">
            Depose un export dans <b>decks/</b>, ou choisis un fichier. Tant qu'aucune liste
            n'est resolue, le banc d'essai reste inerte et le dossier d'analyse ci-dessous
            conserve les constats de la version precedente.
          </div>
        </div>
      )}
    </Card>
  )
}
