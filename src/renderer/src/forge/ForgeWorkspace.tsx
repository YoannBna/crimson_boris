import { useEffect, useState } from 'react'
import { useForge } from '@/lib/useForge'
import { useMtg } from '@/lib/useMtg'
import { DeckColonne } from './DeckColonne'
import { PileVersions } from './PileVersions'
import { VoletAnalyse } from './VoletAnalyse'
import { VoletConstruction } from './VoletConstruction'
import { VoletSimulation } from './VoletSimulation'

export type Volet = 'analyse' | 'simulation' | 'construction'

const TITRES: Record<Volet, string> = {
  analyse: 'Analyse',
  simulation: 'Simulation',
  construction: 'Construction'
}

/* ============================================================
   Mode FORGE
   ============================================================ */

/**
 * Le poste de travail est monte des que le mode Forge est choisi, meme
 * quand aucune categorie n'est encore ouverte : il ne rend rien, mais
 * ses hooks chargent le deck pendant que la constellation s'affiche, et
 * une recherche en cours survit a un aller-retour vers la constellation.
 *
 * La categorie cliquee ne fait que preselectionner le volet de droite.
 * Les trois restent accessibles a tout moment — arriver par « Analyse »
 * ne doit pas enfermer dans l'analyse.
 */
export function ForgeWorkspace({ noeud }: { noeud: string | null }) {
  const { state: mtg, runSim, loadSuggestions, reloadDeck, importFolder } = useMtg()
  const deck = mtg.deck
  const forge = useForge(deck ? `${deck.name}-${deck.importedAt}` : null)

  const [volet, setVolet] = useState<Volet>('analyse')

  useEffect(() => {
    if (noeud === 'analyse' || noeud === 'simulation' || noeud === 'construction') {
      setVolet(noeud)
    }
  }, [noeud])

  // Hors des categories de la Forge, le poste ne s'affiche pas — mais il
  // reste monte, et son etat avec lui.
  const ouvert =
    noeud === 'deck' || noeud === 'analyse' || noeud === 'simulation' || noeud === 'construction'
  if (!ouvert) return null

  const busy = mtg.busy ?? forge.state.busy
  const erreur = mtg.error ?? forge.state.error

  return (
    <div className="forge-work" onClick={(e) => e.stopPropagation()}>
      <DeckColonne deck={deck} busy={mtg.busy} onImport={() => void importFolder()} />

      <section className="oct forge-side">
        <div className="fs-onglets">
          {(Object.keys(TITRES) as Volet[]).map((v) => (
            <button
              key={v}
              className={`fs-onglet${volet === v ? ' on' : ''}`}
              onClick={() => setVolet(v)}
            >
              {TITRES[v]}
            </button>
          ))}
        </div>

        {erreur && <div className="fs-erreur">{erreur}</div>}

        <div className="fs-corps">
          {volet === 'analyse' && (
            <VoletAnalyse
              deck={deck}
              run={mtg.run}
              advice={forge.state.advice}
              busy={forge.state.busy}
              onRelire={() => void forge.refreshAdvice()}
            />
          )}

          {volet === 'simulation' && (
            <VoletSimulation
              run={mtg.run}
              hasDeck={deck !== null}
              busy={mtg.busy}
              onRun={(c) => void runSim(c)}
            />
          )}

          {volet === 'construction' && (
            <VoletConstruction
              deck={deck}
              run={mtg.run}
              advice={forge.state.advice}
              suggestions={mtg.suggestions}
              pool={forge.state.pool}
              plan={forge.state.plan}
              bench={forge.state.bench}
              busy={busy}
              exported={forge.state.exported}
              applied={forge.state.applied}
              onSuggestions={() => void loadSuggestions()}
              onSearch={(text, legalOnly, maxPrice) =>
                void forge.searchPool({ text, legalOnly, maxPrice })
              }
              onPlan={(t) => void forge.planDirectives(t)}
              onCommit={(l) => void forge.commit(l)}
              onDrop={(id) => void forge.drop(id)}
              onClear={() => void forge.clear()}
              onExport={() => void forge.exportPlan()}
              // Le deck est relu apres coup : c'est ce que « valider »
              // doit produire a l'ecran, et non seulement en base.
              onApply={() => void forge.applyPlan(() => void reloadDeck())}
            />
          )}
        </div>
      </section>

      <PileVersions
        versions={forge.state.versions}
        busy={busy}
        onCharger={(id) => void forge.revertTo(id, () => void reloadDeck())}
      />
    </div>
  )
}
