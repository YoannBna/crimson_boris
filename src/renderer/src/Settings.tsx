import { useEffect, useState } from 'react'
import type { AppConfig, ConnectorId, OperatorProfile } from '@shared/config'
import { ConnectorFields } from './components/ConnectorFields'

/*
 * Panneau de profil et parametres.
 *
 * Accessible a tout moment depuis le bandeau : passer l'ecran d'accueil
 * sans tout renseigner n'enferme plus personne. Il emprunte exactement
 * le meme pont IPC que l'accueil — `config:secret` en ecriture seule,
 * chiffrement par le trousseau du systeme, aucun canal de relecture.
 */

const CONNECTORS: { id: ConnectorId; title: string; role: string }[] = [
  {
    id: 'mail',
    title: 'Courrier',
    role: 'Releve les messages porteurs d’action et les classe par criticite.'
  },
  {
    id: 'markets',
    title: 'Flux financiers',
    role: 'Releve les cotations et surveille les seuils de choc.'
  },
  {
    id: 'archidekt',
    title: 'Archidekt',
    role: 'Importe tes listes de cartes dans la Forge.'
  }
]

export function Settings({
  config,
  busy,
  error,
  onSecret,
  onClear,
  onProfile,
  onPurge,
  onClose
}: {
  config: AppConfig
  busy: boolean
  error: string | null
  onSecret: (c: ConnectorId, key: string, value: string) => void
  onClear: (c: ConnectorId) => void
  onProfile: (patch: Partial<OperatorProfile>) => void
  onPurge: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(config.profile.displayName)
  const [deck, setDeck] = useState(config.profile.archidektDeck)

  // Fermeture au clavier : un panneau modal qui ne se ferme qu'a la souris
  // est un piege.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const linked = config.connectors.filter((c) => c.state === 'configure').length

  return (
    <div className="set-veil" onClick={onClose}>
      <div className="set-sheet" onClick={(e) => e.stopPropagation()}>
        <header className="set-head">
          <div>
            <h2>PROFIL &amp; PARAMETRES</h2>
            <span className="set-sub">
              {linked} connecteur{linked > 1 ? 's' : ''} relie{linked > 1 ? 's' : ''} sur{' '}
              {config.connectors.length}
            </span>
          </div>
          <button className="set-close" onClick={onClose} title="Fermer (Echap)">
            ×
          </button>
        </header>

        <div className="set-body">
          {!config.secureStorageAvailable && (
            <div className="onb-warn">
              ⚠ Le trousseau du systeme est indisponible. Boris{' '}
              <b>refusera d’enregistrer un identifiant</b> plutot que de l’ecrire en clair.
            </div>
          )}

          {/* --- Operateur --------------------------------------- */}
          <section className="onb-block">
            <div className="onb-label">Operateur</div>
            <p className="onb-role">
              Nom affiche dans le bandeau. Purement esthetique, jamais transmis nulle part.
            </p>
            <input
              className="onb-input"
              value={name}
              placeholder="ex. Y. B. — libre"
              onChange={(e) => setName(e.target.value)}
              onBlur={() => onProfile({ displayName: name })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onProfile({ displayName: name })
              }}
            />
          </section>

          {/* --- Connecteurs ------------------------------------- */}
          {CONNECTORS.map((c) => {
            const status = config.connectors.find((x) => x.id === c.id)
            const state = status?.state ?? 'absent'
            return (
              <section className={`onb-block onb-${state}`} key={c.id}>
                <div className="onb-block-h">
                  <span className="onb-label">{c.title}</span>
                  <span className={`onb-state st-${state}`}>
                    {state === 'configure'
                      ? 'connecte'
                      : state === 'ignore'
                        ? 'ecarte'
                        : 'inactif'}
                  </span>
                </div>
                <p className="onb-role">{c.role}</p>

                <ConnectorFields
                  id={c.id}
                  status={status}
                  onSecret={onSecret}
                  onClear={onClear}
                  busy={busy}
                  editable
                />

                {c.id === 'archidekt' && (
                  <label className="onb-field set-deck">
                    <span>
                      Deck suivi <i>— URL ou identifiant</i>
                    </span>
                    <input
                      className="onb-input"
                      value={deck}
                      spellCheck={false}
                      placeholder="https://archidekt.com/decks/1234567  ou  1234567"
                      onChange={(e) => setDeck(e.target.value)}
                      onBlur={() => onProfile({ archidektDeck: deck })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onProfile({ archidektDeck: deck })
                      }}
                    />
                    <em className="set-hint">
                      Adresse publique : elle est stockee en clair, contrairement au jeton.
                      L’import par fichier reste disponible dans la Forge.
                    </em>
                  </label>
                )}
              </section>
            )
          })}

          {error && <div className="onb-warn">⚠ {error}</div>}

          {/* --- Effacement -------------------------------------- */}
          <section className="onb-block set-danger">
            <div className="onb-label">Effacement</div>
            <p className="onb-role">
              Supprime definitivement le profil, les identifiants chiffres, l’historique des
              cycles, les cotations, les decks importes et le cache de cartes.
            </p>
            <button className="btn set-purge" onClick={onPurge} disabled={busy}>
              Effacer toutes mes donnees
            </button>
          </section>
        </div>

        <footer className="set-foot">
          <span className="set-legal">
            Les identifiants sont chiffres par le trousseau du systeme et ne remontent jamais a
            l’interface — elle sait qu’ils existent, pas ce qu’ils valent.
          </span>
          <button className="btn" onClick={onClose}>
            {busy ? 'Enregistrement…' : 'Fermer'}
          </button>
        </footer>
      </div>
    </div>
  )
}
