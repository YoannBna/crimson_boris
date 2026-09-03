import { useEffect, useState } from 'react'
import type { ChosenArt, Printing, StyleFind } from '@shared/mtg'
import { Pinceau } from './Pinceau'
import { Bloc } from './VoletAnalyse'

/* ============================================================
   Arts economiques — module du volet Construction
   ============================================================ */

/**
 * Une carte a la fois.
 *
 * Boris propose les illustrations les plus travaillees qu'il trouve
 * sous six euros ; l'operateur en retient une, ou passe. Dans les deux
 * cas la suggestion cede la place a la suivante — une grille de douze
 * cartes et quarante vignettes ne se tranche jamais.
 */
export function VoletArts({
  styles,
  arts,
  busy,
  onCharger,
  onChoisir
}: {
  styles: StyleFind[]
  arts: Record<string, ChosenArt>
  busy: string | null
  onCharger: () => void
  onChoisir: (cardName: string, p: Printing) => void
}) {
  const [passees, setPassees] = useState<Set<string>>(new Set())

  // Une nouvelle serie repart du debut : garder les cartes ecartees
  // ferait apparaitre la file au milieu, sans que rien ne l'explique.
  useEffect(() => setPassees(new Set()), [styles])

  /*
   * Pas de curseur : la file EST le reste a traiter. Retenir une
   * illustration ou passer retire la carte, et la suivante prend sa
   * place d'elle-meme. Un index en parallele se serait desynchronise
   * du premier retrait.
   */
  const file = styles.filter((s) => !passees.has(s.cardName) && arts[s.cardName] === undefined)
  const courante = file[0]

  if (styles.length === 0) {
    return (
      <Bloc titre="Arts economiques" ton="chaud">
        <p className="j-body">
          Boris cherche, pour les cartes de ta liste, les impressions les plus travaillees
          disponibles sous six euros : sans bordure, pleine page, cadres vitrine. Retenir une
          illustration l'applique au deck et la fait suivre jusque dans l'export.
        </p>
        <button className="bouton bouton-chaud" disabled={Boolean(busy)} onClick={onCharger}>
          {busy ?? 'Chercher des illustrations'}
        </button>
      </Bloc>
    )
  }

  const retenues = styles.filter((s) => arts[s.cardName] !== undefined).length

  return (
    <Bloc titre={`Arts economiques · ${file.length} en attente`} ton="chaud">
      {courante === undefined ? (
        <>
          <p className="j-body">
            File epuisee — {retenues} illustration(s) retenue(s) sur {styles.length} proposees.
          </p>
          <button className="bouton" disabled={Boolean(busy)} onClick={onCharger}>
            {busy ?? 'Relancer la recherche'}
          </button>
        </>
      ) : (
        <>
          {/* Le bouton « Passer » voyage avec l'en-tete : place sous les
              vignettes, il passait sous la ligne de flottaison des que
              la carte proposait trois illustrations. */}
          <div className="va-tete">
            <span className="va-nom">{courante.cardName}</span>
            {courante.current && (
              <span className="va-actuel j-dim">
                actuelle : {courante.current.setCode.toUpperCase()}
                {courante.current.priceEur !== null &&
                  ` · ${courante.current.priceEur.toFixed(2)} €`}
              </span>
            )}
            <button
              className="va-passer"
              onClick={() => setPassees((p) => new Set(p).add(courante.cardName))}
              disabled={Boolean(busy)}
            >
              Passer
            </button>
          </div>

          <div className="va-grille">
            {courante.candidates.map((p) => (
              <button
                key={p.scryfallId}
                className="va-carte"
                onClick={() => onChoisir(courante.cardName, p)}
                title={p.artist ? `Illustration : ${p.artist}` : undefined}
              >
                {p.imageNormal ? <img src={p.imageNormal} alt="" loading="lazy" /> : <span>—</span>}
                <span className="va-set">{p.setCode.toUpperCase()}</span>
                <span className="va-prix">
                  {p.priceEur === null ? '—' : `${p.priceEur.toFixed(2)} €`}
                </span>
              </button>
            ))}
          </div>

          {retenues > 0 && (
            <span className="va-reste j-dim">
              <Pinceau taille={12} /> {retenues} illustration(s) retenue(s) — le badge suit la
              carte jusque dans l'export.
            </span>
          )}
        </>
      )}
    </Bloc>
  )
}
