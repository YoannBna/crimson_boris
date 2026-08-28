import { useEffect, useState } from 'react'
import type { TriggerSource } from '@shared/types'
import { Aura } from './components/Aura'
import { BorisAvatar } from './components/BorisAvatar'
import { hasBridge, useCoreStatus } from './lib/useBoris'

/*
 * Coquille de la refonte — etape 1.
 *
 * Elle porte le socle visuel et l'avatar. La navigation en
 * constellations, le mode Forge et l'inspection des cartes viendront
 * s'y greffer aux etapes suivantes.
 */

/**
 * Le message d'accueil suit le declencheur reel du cycle : Boris ne dit
 * pas la meme chose au demarrage et au retour de veille. L'information
 * existe deja dans le noyau, autant qu'elle serve.
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
    case 'boot':
      return `Bonjour${qui}.`
    default:
      return `Bonjour${qui}.`
  }
}

export function JarvisShell({ operateur = '' }: { operateur?: string }) {
  const status = useCoreStatus()
  const [ancre, setAncre] = useState<'centre' | 'haut'>('centre')
  const [message, setMessage] = useState<string | null>(null)

  // L'avatar salue a chaque nouveau declencheur de reveil, pas seulement
  // au premier rendu : c'est le propre d'une sortie de veille.
  useEffect(() => {
    if (!status) return
    setMessage(salutation(status.lastTrigger, operateur))
    setAncre('centre')
  }, [status?.lastTrigger, status?.lastCycle, operateur])

  return (
    <div className="jarvis">
      <Aura />

      <div className={`avatar-dock${ancre === 'centre' ? ' centre' : ''}`}>
        <BorisAvatar
          size={ancre === 'centre' ? 260 : 132}
          greeting={message}
          onActivate={() => setAncre((a) => (a === 'centre' ? 'haut' : 'centre'))}
        />
      </div>

      {ancre === 'haut' && (
        <main className="jarvis-scene">
          <section className="oct oct-cold jarvis-card">
            <div className="j-title">Noyau</div>
            <p className="j-body">
              Cycle autonome, detection de sortie de veille, radar financier. Le socle de la v2
              reste en place — seule sa surface change.
            </p>
            <div className="j-dim">
              {status
                ? `${status.modulesFed} / ${status.modulesTotal} modules alimentes`
                : 'en attente du noyau'}
            </div>
          </section>

          <section className="oct oct-warm jarvis-card">
            <div className="j-title">Forge</div>
            <p className="j-body">
              Import Archidekt, pool Scryfall, directives ecrites, etabli et pile de versions.
            </p>
            <div className="j-dim">a venir : constellation et inspection des cartes</div>
          </section>

          <div className="jarvis-actions">
            <button className="oct-btn" onClick={() => setAncre('centre')}>
              Revenir au centre
            </button>
            <button className="oct-btn oct-btn-warm">Entrer dans la Forge</button>
          </div>
        </main>
      )}

      {ancre === 'centre' && (
        <div className="jarvis-hint j-dim">
          {hasBridge ? 'Touche l’avatar pour ouvrir' : 'hors coquille Electron'}
        </div>
      )}
    </div>
  )
}
