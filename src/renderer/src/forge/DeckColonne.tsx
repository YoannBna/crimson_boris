import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Card, ChosenArt, ResolvedDeck } from '@shared/mtg'
import { ForgeLogo } from './ForgeLogo'
import { Mana } from './Mana'
import { Pinceau } from './Pinceau'
import { ranger, statistiques, type Exemplaire, type Groupe } from './lecture'

/* ============================================================
   Colonne du deck : ce que la liste EST
   ============================================================ */

export function DeckColonne({
  deck,
  arts,
  busy,
  onImport,
  onInspecter
}: {
  deck: ResolvedDeck | null
  arts: Record<string, ChosenArt>
  busy: string | null
  onImport: () => void
  onInspecter: (card: Card) => void
}) {
  if (!deck) {
    return (
      <section className="cadre cadre-chaud forge-deck">
        <div className="forge-vide">
          <ForgeLogo size={118} />
          <span className="j-title">Aucune liste chargee</span>
          <p className="j-body">
            La Forge lit un export Archidekt, Moxfield ou un .dec. Elle en tire les categories,
            la courbe, la valeur et la base de mana — puis les trois volets a droite se
            remplissent.
          </p>
          <button className="bouton bouton-chaud" onClick={onImport} disabled={Boolean(busy)}>
            {busy ?? 'Importer une liste'}
          </button>
        </div>
      </section>
    )
  }

  return <DeckCharge deck={deck} arts={arts} onInspecter={onInspecter} />
}

/** Carte tiree du paquet au survol : position calculee sur la ligne survolee. */
interface Apercu {
  card: Card
  x: number
  y: number
}

const APERCU_L = 232
const APERCU_H = 324
/** Retrait entre la carte tiree et le bord de la colonne. */
const MARGE = 14

function DeckCharge({
  deck,
  arts,
  onInspecter
}: {
  deck: ResolvedDeck
  arts: Record<string, ChosenArt>
  onInspecter: (card: Card) => void
}) {
  const { groupes, source } = useMemo(() => ranger(deck), [deck])
  const stats = useMemo(() => statistiques(deck), [deck])
  const [replies, setReplies] = useState<Set<string>>(new Set())
  const [apercu, setApercu] = useState<Apercu | null>(null)

  const basculer = (key: string): void =>
    setReplies((s) => {
      const n = new Set(s)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })

  /*
   * Un seul apercu, positionne a la volee, plutot qu'une image par
   * ligne : la liste compte cent lignes, et cent illustrations chargees
   * pour une seule visible seraient payees en memoire comme en reseau.
   */
  const tirer = (card: Card, cible: HTMLElement): void => {
    const r = cible.getBoundingClientRect()
    const paquet = cible.closest('.forge-deck')?.getBoundingClientRect() ?? r

    /*
     * La carte reste DANS la colonne du deck.
     *
     * Elle sortait auparavant par le bord droit du volet et se posait
     * sur les trois volets d'analyse, qu'elle masquait entierement. Ses
     * deux bords sont desormais bornes par ceux de la colonne : quoi
     * qu'il arrive elle ne deborde plus sur le reste du poste.
     */
    const gauche = paquet.left + MARGE
    const droite = paquet.right - APERCU_L - MARGE

    /*
     * A l'interieur de cette borne, elle se pose du cote OPPOSE a la
     * ligne survolee. La liste tient sur deux colonnes de noms : se
     * poser du meme cote recouvrirait justement celle que l'oeil est en
     * train de parcourir.
     */
    const milieu = paquet.left + paquet.width / 2
    const voulu = r.left + r.width / 2 < milieu ? droite : gauche

    setApercu({
      card,
      // `max` en dernier : sur une colonne trop etroite pour la carte,
      // mieux vaut deborder a droite — vers le volet — que de sortir de
      // l'ecran par la gauche.
      x: Math.max(gauche, Math.min(voulu, droite)),
      y: Math.min(Math.max(8, r.top - APERCU_H / 2 + r.height / 2), window.innerHeight - APERCU_H - 8)
    })
  }

  const maxCourbe = Math.max(1, ...stats.courbe)

  return (
    <section className="cadre cadre-chaud forge-deck">
      <header className="fd-head">
        <div className="fd-titre">
          <ForgeLogo size={40} />
          <span className="j-title">{deck.name}</span>
          <span className={`fd-total${stats.total === 100 ? ' ok' : ' hs'}`}>
            {stats.total} / 100
          </span>
        </div>

        <div className="fd-chiffres">
          <Chiffre v={String(stats.terrains)} l="terrains" />
          <Chiffre v={stats.cmcMoyen.toFixed(2)} l="cout moyen" />
          <Chiffre
            v={`${stats.prix.toFixed(0)} €`}
            l={stats.prixInconnus > 0 ? `valeur · ${stats.prixInconnus} sans prix` : 'valeur'}
          />
          <span className="fd-identite">
            {stats.identite.map((c) => (
              <span className={`msym m-${c.toLowerCase()}`} key={c}>
                {c}
              </span>
            ))}
          </span>
        </div>

        {/* Courbe de mana : huit barres valent mieux qu'un tableau. */}
        <div className="fd-courbe" title="Sorts par cout converti, terrains exclus">
          {stats.courbe.map((n, i) => (
            <span className="fd-bar" key={i}>
              <span className="fd-bar-fill" style={{ height: `${(n / maxCourbe) * 100}%` }} />
              <span className="fd-bar-n">{n}</span>
              <span className="fd-bar-l">{i === 7 ? '7+' : i}</span>
            </span>
          ))}
        </div>

        <div className="fd-source j-dim">
          {source === 'archidekt'
            ? 'classement : categories de ton export'
            : 'classement : roles deduits — reimporte la liste pour retrouver tes categories'}
        </div>
      </header>

      <div className="fd-liste" onMouseLeave={() => setApercu(null)}>
        {groupes.map((g) => (
          <GroupeBloc
            key={g.key}
            groupe={g}
            arts={arts}
            replie={replies.has(g.key)}
            onBascule={() => basculer(g.key)}
            onSurvol={tirer}
            onQuitte={() => setApercu(null)}
            onInspecter={onInspecter}
          />
        ))}

        {deck.unresolved.length > 0 && (
          <div className="fd-nonresolu">
            <b>{deck.unresolved.length}</b> nom(s) non resolu(s) :{' '}
            {deck.unresolved.map((u) => u.name).join(', ')}
          </div>
        )}
      </div>

      {apercu && <ApercuCarte apercu={apercu} art={arts[apercu.card.name]} />}

    </section>
  )
}

/**
 * La carte sortie du paquet.
 *
 * Rendue dans `document.body` et non dans le volet : celui-ci rogne ce
 * qui deborde de lui, et la carte doit justement sortir de la liste.
 */
function ApercuCarte({ apercu, art }: { apercu: Apercu; art: ChosenArt | undefined }) {
  const image = art?.imageNormal ?? apercu.card.imageNormal
  if (!image) return null

  return createPortal(
    <div
      className="fd-apercu"
      style={{ left: apercu.x, top: apercu.y, width: APERCU_L, height: APERCU_H }}
    >
      <img src={image} alt="" />
      {art && (
        <span className="fd-apercu-badge">
          <Pinceau taille={19} titre={`Art choisi : ${art.setName}`} />
        </span>
      )}
    </div>,
    document.body
  )
}

function Chiffre({ v, l }: { v: string; l: string }) {
  return (
    <span className="fd-chiffre">
      <b>{v}</b>
      <i>{l}</i>
    </span>
  )
}

function GroupeBloc({
  groupe,
  arts,
  replie,
  onBascule,
  onSurvol,
  onQuitte,
  onInspecter
}: {
  groupe: Groupe
  arts: Record<string, ChosenArt>
  replie: boolean
  onBascule: () => void
  onSurvol: (card: Card, cible: HTMLElement) => void
  onQuitte: () => void
  onInspecter: (card: Card) => void
}) {
  return (
    <div className={`fd-groupe${replie ? ' replie' : ''}`}>
      <button className="fd-groupe-h" onClick={onBascule}>
        <span className="fd-chevron">{replie ? '▸' : '▾'}</span>
        <span className="fd-groupe-n">{groupe.label}</span>
        <span className="fd-groupe-c">{groupe.total}</span>
      </button>
      {!replie && (
        <div className="fd-cartes">
          {groupe.cards.map((e) => (
            <LigneCarte
              key={e.card.name}
              e={e}
              art={arts[e.card.name]}
              onSurvol={onSurvol}
              onQuitte={onQuitte}
              onInspecter={onInspecter}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function LigneCarte({
  e,
  art,
  onSurvol,
  onQuitte,
  onInspecter
}: {
  e: Exemplaire
  art: ChosenArt | undefined
  onSurvol: (card: Card, cible: HTMLElement) => void
  onQuitte: () => void
  onInspecter: (card: Card) => void
}) {
  return (
    <button
      className="fd-carte"
      title={`${e.card.typeLine} — clic pour inspecter`}
      onMouseEnter={(ev) => onSurvol(e.card, ev.currentTarget)}
      onFocus={(ev) => onSurvol(e.card, ev.currentTarget)}
      onMouseLeave={onQuitte}
      onBlur={onQuitte}
      onClick={() => {
        // L'apercu doit disparaitre avant l'inspection : sans cela il
        // resterait accroche derriere la vue, en attente d'un
        // mouseleave qui ne vient jamais.
        onQuitte()
        onInspecter(e.card)
      }}
    >
      <span className="fd-n">{e.n > 1 ? `${e.n}×` : ''}</span>
      <span className="fd-nom">{e.card.name}</span>
      {art && <Pinceau taille={11} titre={`Art choisi : ${art.setName}`} />}
      <Mana cost={e.card.manaCost} />
      <span className="fd-prix">
        {(art?.priceEur ?? e.card.priceEur) === null
          ? '—'
          : (art?.priceEur ?? e.card.priceEur)?.toFixed(2)}
      </span>
    </button>
  )
}
