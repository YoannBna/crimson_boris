import { useCallback, useEffect, useState } from 'react'
import type { TriggerSource } from '@shared/types'
import { Aura } from './components/Aura'
import { BorisAvatar } from './components/BorisAvatar'
import { Constellation } from './nav/Constellation'
import { ForgeLogo } from './forge/ForgeLogo'
import { ForgeWorkspace } from './forge/ForgeWorkspace'
import { OptiVolet } from './opti/OptiVolet'
import { MODES, findMode, type ModeId } from './nav/map'
import { hasBridge, useCoreStatus } from './lib/useBoris'
import { useConfig } from './lib/useConfig'
import { Porte } from './shell/Porte'
import { Profil } from './shell/Profil'
import { EtatCycle } from './shell/EtatCycle'
import { Version } from './shell/Version'

/*
 * Coquille de la refonte.
 *
 * Trois profondeurs de navigation, et une seule regle : on descend par
 * un clic sur ce qui interesse, on remonte par un clic dans le vide.
 *
 *   1. choix du mode      — l'avatar au centre, deux voies
 *   2. constellation      — toutes les sous-categories en miniature
 *   3. categorie ouverte  — plein ecran, constellation reduite en fond
 *
 * En mode Forge, la troisieme profondeur n'est pas une fiche mais un
 * poste de travail complet : le deck a gauche, trois volets a droite,
 * la pile des versions en bas.
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

export function JarvisShell() {
  const status = useCoreStatus()
  const { config, busy, error, run } = useConfig()
  const [mode, setMode] = useState<ModeId | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [profil, setProfil] = useState(false)

  const operateur = config?.profile.displayName ?? ''
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

  // Tant que la configuration n'est pas lue, rien ne s'affiche : mieux
  // vaut un instant vide qu'une constellation qui clignote avant de
  // ceder la place a la porte d'entree.
  if (hasBridge && !config) return null

  if (hasBridge && config && !config.onboarded) {
    return (
      <Porte
        config={config}
        busy={busy}
        error={error}
        onSecret={(c, key, value) =>
          void run(() => window.boris.config.setSecret(c, key, value))
        }
        onSkip={(c) => void run(() => window.boris.config.skipConnector(c))}
        onProfile={(displayName) =>
          void run(() => window.boris.config.saveProfile({ displayName }))
        }
        onComplete={() => void run(() => window.boris.config.complete())}
      />
    )
  }

  const courant = mode ? findMode(mode) : null
  const noeud = courant && focus ? courant.nodes.find((n) => n.id === focus) : null
  // Un connecteur ni relie ni ecarte reste une decision en suspens : la
  // pastille le rappelle sans rien bloquer.
  const enAttente = config?.connectors.filter((c) => c.state === 'absent').length ?? 0

  // Les deux modes ouvrent desormais un volet plein cadre : la
  // constellation reduite se replie dans le coin bas-droit, seul creux
  // que ni l'avatar ni les volets ne reclament.
  const travail = focus !== null

  return (
    <div
      className={`jarvis depth-${depth}${travail ? ' travail' : ''}`}
      onClick={depth === 'accueil' ? undefined : remonter}
    >
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
              {/* La Forge porte son enseigne ; Opti n'en a pas besoin,
                  et lui en inventer une pour la symetrie serait du
                  remplissage. */}
              {m.id === 'forge' && <ForgeLogo size={86} />}
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
      {courant?.id === 'forge' && <ForgeWorkspace noeud={focus} />}
      {courant?.id === 'opti' && <OptiVolet noeud={noeud ?? null} />}

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

      {/* --- Barre permanente ------------------------------------- */}
      <div className="jv-barre" onClick={(e) => e.stopPropagation()}>
        <EtatCycle status={status} />

        {/* La pastille vit hors du bouton : le `clip-path` octogonal de
            `oct-btn` rogne ses descendants, et elle y perdait un coin. */}
        <span className="jv-profil">
          <button
            className="jv-profil-btn oct-btn"
            onClick={() => setProfil(true)}
            title="Profil et parametres"
          >
            {operateur.trim() === '' ? 'Profil' : operateur}
          </button>
          {enAttente > 0 && (
            <span className="jv-pastille" title={`${enAttente} connecteur(s) en attente`}>
              {enAttente}
            </span>
          )}
        </span>
        <Version />
      </div>

      {profil && config && (
        <Profil
          config={config}
          busy={busy}
          error={error}
          onSecret={(c, key, value) =>
            void run(() => window.boris.config.setSecret(c, key, value))
          }
          onClear={(c) => void run(() => window.boris.config.clearConnector(c))}
          onProfile={(patch) => void run(() => window.boris.config.saveProfile(patch))}
          onPurge={() =>
            void run(async () => {
              await window.boris.config.purge()
              // Le profil disparait : on relit l'etat plutot que de
              // laisser un panneau decrire des donnees effacees.
              setProfil(false)
              return window.boris.config.get()
            })
          }
          onFermer={() => setProfil(false)}
        />
      )}
    </div>
  )
}
