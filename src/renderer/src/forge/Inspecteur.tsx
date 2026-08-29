import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Card, ChosenArt, Printing } from '@shared/mtg'
import { hasBridge } from '@/lib/useBoris'
import { Mana } from './Mana'
import { Pinceau } from './Pinceau'

/* ============================================================
   Vue d'inspection
   ============================================================ */

/**
 * La carte en grand a gauche, toutes ses impressions a droite avec leur
 * prix. Les impressions arrivent triees du moins cher au plus cher —
 * c'est l'ordre dans lequel on choisit une illustration quand le budget
 * compte, et l'inverse se retrouve d'un coup d'oeil en fin de liste.
 */
export function Inspecteur({
  card,
  art,
  onChoisir,
  onRetirer,
  onFermer
}: {
  card: Card
  art: ChosenArt | undefined
  onChoisir: (p: Printing) => void
  onRetirer: () => void
  onFermer: () => void
}) {
  const [impressions, setImpressions] = useState<Printing[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    if (!hasBridge) return
    let vivant = true
    setImpressions(null)
    setErreur(null)
    void window.boris.mtg
      .getPrintings(card.name)
      .then((p) => vivant && setImpressions(parPrix(p)))
      .catch((e: unknown) => vivant && setErreur(e instanceof Error ? e.message : String(e)))
    return () => {
      vivant = false
    }
  }, [card.name])

  // Echap ferme l'inspection sans remonter d'un cran de navigation :
  // sinon fermer une carte ferait aussi quitter la Forge.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onFermer()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onFermer])

  const image = art?.imageNormal ?? card.imageNormal
  const actuelle = art
    ? `${art.setCode.toUpperCase()} · ${art.collectorNumber}`
    : `${card.setCode.toUpperCase()} · ${card.collectorNumber}`

  // Comme l'apercu : hors du volet, dont le `clip-path` rognerait la vue.
  return createPortal(
    <div className="insp-fond" onClick={onFermer}>
      <div className="insp oct" onClick={(e) => e.stopPropagation()}>
        {/* --- Carte, a gauche --- */}
        <div className="insp-carte">
          <div className="insp-visuel">
            {image ? (
              <img src={image} alt={card.name} />
            ) : (
              <div className="insp-sans-image j-dim">illustration indisponible</div>
            )}
            {art && (
              <span className="insp-badge">
                <Pinceau taille={22} titre={`Art choisi : ${art.setName}`} />
              </span>
            )}
          </div>

          <div className="insp-ident">
            <span className="j-title">{card.name}</span>
            <Mana cost={card.manaCost} />
          </div>
          <div className="insp-type j-dim">{card.typeLine}</div>
          <div className="insp-actuelle">
            impression affichee : <b>{actuelle}</b>
            {art && (
              <button className="insp-retirer" onClick={onRetirer}>
                revenir a l'originale
              </button>
            )}
          </div>
        </div>

        {/* --- Impressions, a droite --- */}
        <div className="insp-panneau">
          <header className="insp-h">
            <span className="j-title">Versions et illustrations</span>
            <button className="insp-x" onClick={onFermer} title="Fermer (Echap)">
              ×
            </button>
          </header>

          {erreur && <div className="insp-err">{erreur}</div>}

          {impressions === null && !erreur && (
            <div className="insp-attente j-dim">interrogation de Scryfall…</div>
          )}

          {impressions !== null && impressions.length === 0 && (
            <div className="insp-attente j-dim">aucune impression retournee.</div>
          )}

          {impressions !== null && impressions.length > 0 && (
            <>
              <div className="j-dim insp-compte">
                {impressions.length} impressions, de la moins chere a la plus chere —
                celles sans cote ferment la liste
              </div>
              <div className="insp-grille">
                {impressions.map((p) => (
                  <button
                    key={p.scryfallId}
                    className={`insp-imp${art?.scryfallId === p.scryfallId ? ' on' : ''}`}
                    onClick={() => onChoisir(p)}
                    title={p.artist ? `Illustration : ${p.artist}` : undefined}
                  >
                    {p.imageNormal ? (
                      <img src={p.imageNormal} alt="" loading="lazy" />
                    ) : (
                      <span className="insp-imp-vide">—</span>
                    )}
                    <span className="insp-imp-set">{p.setCode.toUpperCase()}</span>
                    <span className="insp-imp-prix">
                      {p.priceEur === null ? '—' : `${p.priceEur.toFixed(2)} €`}
                    </span>
                    {marqueurs(p).length > 0 && (
                      <span className="insp-imp-tags">{marqueurs(p).join(' · ')}</span>
                    )}
                    {art?.scryfallId === p.scryfallId && (
                      <span className="insp-imp-badge">
                        <Pinceau taille={13} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

/**
 * Du moins cher au plus cher, les impressions sans cote a la fin.
 *
 * Scryfall les place en tete de son propre tri, ce qui contredisait la
 * ligne affichee au-dessus de la grille : trois cartes sans prix
 * ouvraient une liste annoncee comme croissante.
 */
function parPrix(list: Printing[]): Printing[] {
  return [...list].sort((a, b) => {
    if (a.priceEur === null) return b.priceEur === null ? 0 : 1
    if (b.priceEur === null) return -1
    return a.priceEur - b.priceEur
  })
}

/** Ce qui distingue une impression, dit en trois mots plutot qu'en attributs bruts. */
function marqueurs(p: Printing): string[] {
  const out: string[] = []
  if (p.borderColor === 'borderless') out.push('sans bordure')
  if (p.fullArt) out.push('pleine page')
  if (p.frameEffects.includes('showcase')) out.push('vitrine')
  if (p.frameEffects.includes('extendedart')) out.push('art etendu')
  if (p.frameEffects.includes('etched')) out.push('grave')
  if (p.promo && out.length === 0) out.push('promo')
  return out
}
