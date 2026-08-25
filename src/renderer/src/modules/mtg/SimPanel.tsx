import { useState } from 'react'
import type { SimConfig } from '@shared/mtg'
import { Card, Note } from '@/components/primitives'

const GAME_CHOICES = [100, 400, 1000]

export function SimPanel({
  onRun,
  busy,
  disabled
}: {
  onRun: (config: Partial<SimConfig>) => void
  busy: string | null
  disabled: boolean
}) {
  const [opponents, setOpponents] = useState<1 | 3>(3)
  const [games, setGames] = useState(400)
  const [seed, setSeed] = useState(20260821)

  return (
    <Card full title="⚙ Banc d'essai — campagne de parties fictives">
      <div className="sim-form">
        <label>
          <span>Format</span>
          <select
            value={opponents}
            onChange={(e) => setOpponents(Number(e.target.value) as 1 | 3)}
          >
            <option value={3}>Commander — table a quatre</option>
            <option value={1}>Duel — un adversaire</option>
          </select>
        </label>

        <label>
          <span>Parties</span>
          <select value={games} onChange={(e) => setGames(Number(e.target.value))}>
            {GAME_CHOICES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Graine</span>
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
          />
        </label>

        <button
          className="btn"
          disabled={disabled || Boolean(busy)}
          onClick={() => onRun({ opponents, games, seed })}
        >
          {busy ?? 'Lancer la campagne'}
        </button>
      </div>

      <Note>
        Le nombre d'adversaires ne fait pas jouer d'adversaire : il regle la pression subie.
        Plus la table est large, plus il passe de removal et de balayages — sans quoi un
        goldfish flatte tous les decks et ne mesure jamais le besoin d'interaction.
      </Note>
    </Card>
  )
}
