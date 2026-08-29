import type { DeckVersion } from '@shared/forge'

/* ============================================================
   Pile des versions
   ============================================================ */

/**
 * Chaque validation d'un plan empile une version ; charger une version
 * anterieure la recopie en tete plutot que de defaire ce qui suit.
 *
 * C'est pour cela que la pile ne porte ni fleche « precedent » ni
 * fleche « suivant » : rien n'est efface, donc toute version — passee
 * comme abandonnee — est a un clic, dans les deux sens. Deux fleches
 * laisseraient croire a un chemin unique.
 */
export function PileVersions({
  versions,
  busy,
  onCharger
}: {
  versions: DeckVersion[]
  busy: string | null
  onCharger: (id: number) => void
}) {
  if (versions.length === 0) return null

  return (
    <div className="pile">
      <span className="pile-t j-dim">
        Versions
        <b>{versions.length}</b>
      </span>

      <div className="pile-liste">
        {versions.map((v, i) => (
          <button
            key={v.id}
            className={`pile-v${v.current ? ' on' : ''}`}
            disabled={Boolean(busy) || v.current}
            onClick={() => onCharger(v.id)}
            title={
              v.current
                ? 'Version chargee'
                : `Charger cette version — elle sera recopiee en tete, sans rien effacer`
            }
          >
            <span className="pile-rang">{v.current ? 'courante' : `−${i}`}</span>
            <span className="pile-n">{v.cards} cartes</span>
            <span className="pile-d">{horodate(v.importedAt)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function horodate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
