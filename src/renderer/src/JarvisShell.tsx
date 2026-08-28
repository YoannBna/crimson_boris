import { useCallback, useEffect, useState } from 'react'
import type { TriggerSource } from '@shared/types'
import { Aura } from './components/Aura'
import { BorisAvatar } from './components/BorisAvatar'
import { Constellation } from './nav/Constellation'
import { MODES, findMode, type ModeId } from './nav/map'
import { useCoreStatus } from './lib/useBoris'

/*
 * Coquille de la refonte — etapes 1 et 2.
 *
 * Trois profondeurs de navigation, et une seule regle : on descend par
 * un clic sur ce qui interesse, on remonte par un clic dans le vide.
 *
 *   1. choix du mode      — l'avatar au centre, deux voies
 *   2. constellation      — toutes les sous-categories en miniature
 *   3. categorie ouverte  — plein ecran, constellation reduite en fond
 */

function salutation(trigger: TriggerSource | undefined, nom: string): string {
  const qui = nom.trim() === '' ? '' : `, ${nom}`
  switch (trigger) {
    case 'resume':
    case 'clock-jump':
      return `Je me suis assoupi${qui}.`
    case 'unlock':
      return `Te revoila${qui}.`
    case 'active':
      return `Je t'ecoute${qui}.`
    default:
      return `Bonjour${qui}.`
  }
}

type Depth = 'accueil' | 'constellation' | 'focus'

export function JarvisShell({ operateur = '' }: { operateur?: string }) {
  const status = useCoreStatus()
  const [mode, setMode] = useState<ModeId | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const depth: Depth = mode === null ? 'accueil' : focus === null ? 'constellation' : 'focus'

  useEffect(() => {
    if (!status) return
    setMessage(salutation(status.lastTrigger, operateur))
  }, [status?.lastTrigger, status?.lastCycle, operateur])

  /** Remonte d'un cran. Le vide et la fleche partagent ce geste. */
  const remonter = useCallback(() => {
    setFocus((f) => {
      if (f !== null) return null
      setMode(null)
      return null
    })
  }, [])

  // Echap remonte aussi : un environnement qui ne se quitte qu'a la
  // souris enferme.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') remonter()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [remonter])

  const courant = mode ? findMode(mode) : null
  const noeud = courant && focus ? courant.nodes.find((n) => n.id === focus) : null

  return (
    <div className={`jarvis depth-${depth}`} onClick={depth === 'accueil' ? undefined : remonter}>
      <Aura />

      <div className={`avatar-dock${depth === 'accueil' ? ' centre' : ''}`}>
        <BorisAvatar
          size={depth === 'accueil' ? 260 : 104}
          greeting={depth === 'accueil' ? message : null}
          onActivate={() => {
            if (depth === 'accueil') setMode('opti')
          }}
        />
      </div>

      {/* --- 1 · Choix du mode ----------------------------------- */}
      {depth === 'accueil' && (
        <div className="modes" onClick={(e) => e.stopPropagation()}>
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`mode-card oct oct-${m.tone}`}
              onClick={() => setMode(m.id)}
            >
              <span className="mode-label">{m.label}</span>
              <span className="mode-tagline">{m.tagline}</span>
              <span className="mode-count">{m.nodes.length} domaines</span>
            </button>
          ))}
        </div>
      )}

      {/* --- 2 et 3 · Constellation, au premier plan ou en fond --- */}
      {courant && (
        <div className="cst-stage" onClick={(e) => e.stopPropagation()}>
          <Constellation
            mode={courant}
            focus={focus}
            reduced={depth === 'focus'}
            onPick={(id) => setFocus(id)}
          />
        </div>
      )}

      {/* --- 3 · Categorie ouverte -------------------------------- */}
      {noeud && (
        <section className="focus-view oct" onClick={(e) => e.stopPropagation()}>
          <header className="focus-head">
            <span className="j-title">{noeud.label}</span>
            <span className="j-dim">{noeud.role}</span>
          </header>
          <div className="focus-body j-body">
            <p>
              Ce volet recevra son contenu aux etapes suivantes — le mode Forge et l’inspection
              des cartes d’abord, le detail des modules Opti ensuite.
            </p>
            <p className="j-dim">
              La constellation reste derriere, en repere. Un clic dans le vide y ramene.
            </p>
          </div>
        </section>
      )}

      {/* --- Retour flottant -------------------------------------- */}
      {depth !== 'accueil' && (
        <button
          className="retour oct-btn"
          onClick={(e) => {
            e.stopPropagation()
            remonter()
          }}
          title="Remonter (Echap)"
        >
          <span className="retour-fleche">‹</span>
          {depth === 'focus' ? 'Constellation' : 'Choix du mode'}
        </button>
      )}

      {depth === 'accueil' && (
        <div className="jarvis-hint j-dim">choisis une voie</div>
      )}
    </div>
  )
}
