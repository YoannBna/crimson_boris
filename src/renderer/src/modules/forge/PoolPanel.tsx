import { useState } from 'react'
import type { Change, PoolResult } from '@shared/forge'
import { Card, Note } from '@/components/primitives'

const PRESETS: { label: string; query: string }[] = [
  { label: 'Vampires', query: 't:vampire' },
  { label: 'Pioche a 2 mana', query: 'o:"draw" cmc<=2 -t:land' },
  { label: 'Exutoires libres', query: 'o:"sacrifice a creature:"' },
  { label: 'Terrains degages', query: 't:land -o:"enters tapped" -t:basic' },
  { label: 'Balayages', query: 'o:"destroy all creatures"' }
]

export function PoolPanel({
  pool,
  hasDeck,
  onSearch,
  onCommit,
  busy
}: {
  pool: PoolResult | null
  hasDeck: boolean
  onSearch: (q: { text: string; legalOnly: boolean; maxPrice?: number }) => void
  onCommit: (list: Omit<Change, 'id'>[]) => void
  busy: string | null
}) {
  const [text, setText] = useState('')
  // Sans deck, il n'y a pas d'identite couleur a respecter : la case
  // n'aurait aucun effet et serait trompeuse.
  const [legalOnly, setLegalOnly] = useState(hasDeck)
  const [maxPrice, setMaxPrice] = useState('')

  const run = (q: string): void => {
    setText(q)
    onSearch({
      text: q,
      legalOnly,
      maxPrice: maxPrice.trim() === '' ? undefined : Number(maxPrice)
    })
  }

  return (
    <Card full title="⌕ Pool global — recherche Scryfall">
      <div className="pool-bar">
        <input
          className="pool-input"
          value={text}
          spellCheck={false}
          placeholder="Syntaxe Scryfall — ex. t:vampire o:&quot;whenever&quot; cmc<=3"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') run(text)
          }}
        />
        <input
          className="pool-price"
          value={maxPrice}
          placeholder="€ max"
          onChange={(e) => setMaxPrice(e.target.value.replace(/[^\d.,]/g, ''))}
        />
        <label className={`pool-check${hasDeck ? '' : ' off'}`}>
          <input
            type="checkbox"
            checked={legalOnly && hasDeck}
            disabled={!hasDeck}
            onChange={() => setLegalOnly((v) => !v)}
          />
          Identite du commandant
        </label>
        <button className="btn" onClick={() => run(text)} disabled={Boolean(busy) || text.trim() === ''}>
          {busy ?? 'Chercher'}
        </button>
      </div>

      <div className="pool-presets">
        {PRESETS.map((p) => (
          <button key={p.label} className="dir-chip" onClick={() => run(p.query)}>
            {p.label}
          </button>
        ))}
      </div>

      {pool && (
        <>
          <div className="pool-meta">
            <b>{pool.cards.length}</b> resultat(s)
            {pool.truncated && ' (tronque)'} · requete envoyee : <code>{pool.scryfall}</code>
          </div>

          <div className="pool-grid">
            {pool.cards.map((c) => (
              <div className="pool-card" key={c.scryfallId}>
                {c.imageNormal && <img src={c.imageNormal} alt={c.name} loading="lazy" />}
                <div className="pool-foot">
                  <span className="pool-p">
                    {c.priceEur !== null ? `${c.priceEur.toFixed(2)} €` : '— €'}
                  </span>
                  <button
                    className="pool-add"
                    title={`Ajouter ${c.name} a l'etabli`}
                    onClick={() =>
                      onCommit([
                        {
                          kind: 'add',
                          cardName: c.name,
                          card: c,
                          because: `ajoutee depuis le pool · ${pool.query}`,
                          source: 'manuel'
                        }
                      ])
                    }
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Note>
        Acces reel au pool Scryfall — pas une simulation. La syntaxe Scryfall passe telle quelle.
        {hasDeck ? (
          <>
            {' '}La case <b>identite du commandant</b> ajoute la restriction de couleur, sans quoi
            Boris proposerait des cartes injouables dans ce deck.
          </>
        ) : (
          <>
            {' '}La recherche fonctionne sans deck ; la restriction d'identite couleur, elle,
            attend qu'une liste soit importee.
          </>
        )}
      </Note>
    </Card>
  )
}
