import { useMemo, useState } from 'react'
import type { ResolvedDeck } from '@shared/mtg'
import { Mana } from './Mana'
import { ranger, statistiques, type Exemplaire, type Groupe } from './lecture'

/* ============================================================
   Colonne du deck : ce que la liste EST
   ============================================================ */

export function DeckColonne({
  deck,
  busy,
  onImport
}: {
  deck: ResolvedDeck | null
  busy: string | null
  onImport: () => void
}) {
  if (!deck) {
    return (
      <section className="oct oct-warm forge-deck">
        <div className="forge-vide">
          <span className="j-title">Aucune liste chargee</span>
          <p className="j-body">
            La Forge lit un export Archidekt, Moxfield ou un .dec. Elle en tire les categories,
            la courbe, la valeur et la base de mana — puis les trois volets a droite se
            remplissent.
          </p>
          <button className="oct-btn oct-btn-warm" onClick={onImport} disabled={Boolean(busy)}>
            {busy ?? 'Importer une liste'}
          </button>
        </div>
      </section>
    )
  }

  return <DeckCharge deck={deck} />
}

function DeckCharge({ deck }: { deck: ResolvedDeck }) {
  const { groupes, source } = useMemo(() => ranger(deck), [deck])
  const stats = useMemo(() => statistiques(deck), [deck])
  const [replies, setReplies] = useState<Set<string>>(new Set())

  const basculer = (key: string): void =>
    setReplies((s) => {
      const n = new Set(s)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })

  const maxCourbe = Math.max(1, ...stats.courbe)

  return (
    <section className="oct oct-warm forge-deck">
      <header className="fd-head">
        <div className="fd-titre">
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

      <div className="fd-liste">
        {groupes.map((g) => (
          <GroupeBloc
            key={g.key}
            groupe={g}
            replie={replies.has(g.key)}
            onBascule={() => basculer(g.key)}
          />
        ))}

        {deck.unresolved.length > 0 && (
          <div className="fd-nonresolu">
            <b>{deck.unresolved.length}</b> nom(s) non resolu(s) :{' '}
            {deck.unresolved.map((u) => u.name).join(', ')}
          </div>
        )}
      </div>
    </section>
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
  replie,
  onBascule
}: {
  groupe: Groupe
  replie: boolean
  onBascule: () => void
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
            <LigneCarte key={e.card.name} e={e} />
          ))}
        </div>
      )}
    </div>
  )
}

function LigneCarte({ e }: { e: Exemplaire }) {
  return (
    <div className="fd-carte" title={e.card.typeLine}>
      <span className="fd-n">{e.n > 1 ? `${e.n}×` : ''}</span>
      <span className="fd-nom">{e.card.name}</span>
      <Mana cost={e.card.manaCost} />
      <span className="fd-prix">
        {e.card.priceEur === null ? '—' : `${e.card.priceEur.toFixed(2)}`}
      </span>
    </div>
  )
}
