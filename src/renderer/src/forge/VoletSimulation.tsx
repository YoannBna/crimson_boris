import { useMemo, useState } from 'react'
import type { SimConfig, SimResult } from '@shared/mtg'
import { agreger } from './lecture'
import { Attente, Bloc } from './VoletAnalyse'

const PARTIES = [100, 400, 1000]

/* ============================================================
   Volet SIMULATION — ce que la liste PRODUIT
   ============================================================ */

export function VoletSimulation({
  run,
  hasDeck,
  busy,
  onRun
}: {
  run: SimResult | null
  hasDeck: boolean
  busy: string | null
  onRun: (c: Partial<SimConfig>) => void
}) {
  const [opponents, setOpponents] = useState<1 | 3>(3)
  const [games, setGames] = useState(400)
  const [seed, setSeed] = useState(20260829)

  const agr = useMemo(() => (run ? agreger(run) : null), [run])

  if (!hasDeck) return <Attente texte="Charge une liste : la campagne joue le deck contre lui-meme." />

  return (
    <div className="vp">
      <Bloc titre="Campagne" ton="froid">
        <div className="vs-form">
          <label>
            <span>Table</span>
            <select
              value={opponents}
              onChange={(e) => setOpponents(Number(e.target.value) as 1 | 3)}
            >
              <option value={3}>Commander — quatre joueurs</option>
              <option value={1}>Duel — un adversaire</option>
            </select>
          </label>
          <label>
            <span>Parties</span>
            <select value={games} onChange={(e) => setGames(Number(e.target.value))}>
              {PARTIES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Graine</span>
            <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
          </label>
        </div>
        <button
          className="bouton bouton-chaud"
          disabled={Boolean(busy)}
          onClick={() => onRun({ opponents, games, seed })}
        >
          {busy ?? 'Lancer la campagne'}
        </button>
        <p className="vp-note j-dim">
          Le nombre d'adversaires ne fait jouer personne : il regle la pression subie. Une meme
          graine rejoue exactement la meme serie — c'est ce qui rend deux listes comparables.
        </p>
      </Bloc>

      {run && agr ? (
        <>
          <Bloc titre="Ce que les parties donnent" ton="froid">
            <div className="vs-meta j-dim">
              {agr.parties} parties · {run.config.opponents === 1 ? 'duel' : 'table a quatre'} ·
              jusqu'au tour {run.config.maxTurns} · graine {run.config.seed} ·{' '}
              {new Date(run.runAt).toLocaleString('fr-FR')}
            </div>

            <div className="vs-grille">
              <Mesure v={agr.mulligansMoyen.toFixed(2)} l="mulligans par partie" />
              <Mesure v={agr.terrainsOuverture.toFixed(2)} l="terrains en ouverture" />
              <Mesure
                v={agr.troisiemeTerrain === null ? '—' : `T${agr.troisiemeTerrain.toFixed(1)}`}
                l="3e source de mana"
              />
              <Mesure v={agr.manaGaspille.toFixed(1)} l="mana perdu par partie" />
              <Mesure v={agr.posesManquees.toFixed(1)} l="poses de terrain manquees" />
              <Mesure v={agr.cartesCoincees.toFixed(1)} l="cartes bloquees en main" />
              <Mesure
                v={agr.premierPioche === null ? '—' : `T${agr.premierPioche.toFixed(1)}`}
                l={`1re pioche · ${pct(agr.sansPioche)} sans`}
              />
              <Mesure
                v={agr.premiereInteraction === null ? '—' : `T${agr.premiereInteraction.toFixed(1)}`}
                l={`1re interaction · ${pct(agr.sansInteraction)} sans`}
              />
            </div>
          </Bloc>

          <Bloc titre="Terrains en jeu, tour par tour" ton="froid">
            <div className="vs-courbe">
              {agr.terrainsParTour.map((n, i) => (
                <span className="vs-bar" key={i}>
                  <span
                    className="vs-bar-fill"
                    style={{ height: `${(n / Math.max(1, ...agr.terrainsParTour)) * 100}%` }}
                  />
                  <span className="vs-bar-n">{n.toFixed(1)}</span>
                  <span className="vs-bar-l">T{i + 1}</span>
                </span>
              ))}
            </div>
            <p className="vp-note j-dim">
              Moyenne sur {agr.parties} parties. Un palier avant le tour 5 signale une base de
              mana qui decroche plutot qu'une main de depart malheureuse.
            </p>
          </Bloc>

          <Bloc titre={`Constats de campagne · ${run.findings.length}`} ton="froid">
            {run.findings.map((f) => (
              <div className={`vp-item vs-${f.grade}`} key={f.id}>
                <div className="vp-t">
                  <span className="vp-g">{f.grade}</span>
                  {f.title}
                </div>
                <div className="vp-m">{f.measure}</div>
                <div className="vp-r">{f.reading}</div>
              </div>
            ))}
          </Bloc>
        </>
      ) : (
        <p className="j-body vp-attente">
          Aucune campagne enregistree. Elle mesure ce qu'aucune lecture de la liste ne peut voir :
          les tours ou le mana manque, les mains qui ne se vident pas, les cartes qui dorment.
        </p>
      )}
    </div>
  )
}

function Mesure({ v, l }: { v: string; l: string }) {
  return (
    <span className="vs-mesure">
      <b>{v}</b>
      <i>{l}</i>
    </span>
  )
}

function pct(x: number): string {
  return `${Math.round(x * 100)} %`
}
