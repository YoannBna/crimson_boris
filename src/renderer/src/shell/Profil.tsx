import { useEffect, useState } from 'react'
import type { AppConfig, ConnectorId, OperatorProfile } from '@shared/config'
import { ConnectorFields } from '@/components/ConnectorFields'

/* ============================================================
   Profil et parametres
   ============================================================ */

/**
 * La saisie des identifiants passe par `ConnectorFields`. Il n'est pas
 * reecrit : c'est le seul endroit du projet ou un secret est saisi, et
 * le dupliquer est exactement ce qui finit par laisser un mot de passe
 * en clair dans la copie oubliee.
 */

const CONNECTEURS: { id: ConnectorId; titre: string; role: string }[] = [
  { id: 'mail', titre: 'Courrier', role: 'Releve les messages porteurs d’action.' },
  { id: 'markets', titre: 'Flux financiers', role: 'Releve les cotations et surveille les seuils.' },
  { id: 'archidekt', titre: 'Archidekt', role: 'Importe tes listes de cartes dans la Forge.' }
]

const ETAT: Record<string, string> = {
  configure: 'relie',
  ignore: 'ecarte',
  absent: 'inactif'
}

export function Profil({
  config,
  busy,
  error,
  onSecret,
  onClear,
  onProfile,
  onPurge,
  onFermer
}: {
  config: AppConfig
  busy: boolean
  error: string | null
  onSecret: (c: ConnectorId, key: string, value: string) => void
  onClear: (c: ConnectorId) => void
  onProfile: (patch: Partial<OperatorProfile>) => void
  onPurge: () => void
  onFermer: () => void
}) {
  const [nom, setNom] = useState(config.profile.displayName)
  const [deck, setDeck] = useState(config.profile.archidektDeck)
  const [purge, setPurge] = useState(false)

  // Echap ferme, en capture : sinon la coquille remonterait d'un cran de
  // navigation en meme temps que le panneau se ferme.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onFermer()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onFermer])

  const relies = config.connectors.filter((c) => c.state === 'configure').length

  return (
    <div className="jv-voile" onClick={onFermer}>
      <div className="jv-feuille oct" onClick={(e) => e.stopPropagation()}>
        <header className="jv-f-head">
          <span className="j-title">Profil &amp; parametres</span>
          <span className="j-dim">
            {relies} connecteur{relies > 1 ? 's' : ''} relie{relies > 1 ? 's' : ''} sur{' '}
            {config.connectors.length}
          </span>
          <button className="jv-f-x" onClick={onFermer} title="Fermer (Echap)">
            ×
          </button>
        </header>

        <div className="jv-f-corps">
          {!config.secureStorageAvailable && (
            <div className="jv-alerte">
              Le trousseau du systeme est indisponible. Boris{' '}
              <b>refusera d’enregistrer un identifiant</b> plutot que de l’ecrire en clair.
            </div>
          )}

          <section className="jv-bloc">
            <div className="jv-bloc-t">Operateur</div>
            <p className="jv-bloc-r">
              Nom affiche a l’accueil. Purement esthetique, jamais transmis nulle part.
            </p>
            <input
              className="onb-input"
              value={nom}
              placeholder="libre"
              onChange={(e) => setNom(e.target.value)}
              onBlur={() => onProfile({ displayName: nom })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onProfile({ displayName: nom })
              }}
            />
          </section>

          {CONNECTEURS.map((c) => {
            const status = config.connectors.find((x) => x.id === c.id)
            const etat = status?.state ?? 'absent'
            return (
              <section className="jv-bloc" key={c.id}>
                <div className="jv-bloc-h">
                  <span className="jv-bloc-t">{c.titre}</span>
                  <span className={`jv-etat e-${etat}`}>{ETAT[etat]}</span>
                </div>
                <p className="jv-bloc-r">{c.role}</p>

                <ConnectorFields
                  id={c.id}
                  status={status}
                  onSecret={onSecret}
                  onClear={onClear}
                  busy={busy}
                  editable
                />

                {c.id === 'archidekt' && (
                  <label className="onb-field">
                    <span>
                      Deck suivi <i>— URL ou identifiant</i>
                    </span>
                    <input
                      className="onb-input"
                      value={deck}
                      spellCheck={false}
                      placeholder="https://archidekt.com/decks/1234567"
                      onChange={(e) => setDeck(e.target.value)}
                      onBlur={() => onProfile({ archidektDeck: deck })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onProfile({ archidektDeck: deck })
                      }}
                    />
                    <em className="jv-bloc-r">
                      Adresse publique : stockee en clair, contrairement au jeton.
                    </em>
                  </label>
                )}
              </section>
            )
          })}

          {error && <div className="jv-alerte">{error}</div>}

          <section className="jv-bloc jv-danger">
            <div className="jv-bloc-t">Effacement</div>
            <p className="jv-bloc-r">
              Supprime definitivement le profil, les identifiants chiffres, l’historique des
              cycles, les cotations, les decks importes et le cache de cartes.
            </p>
            {/* Confirmation en deux temps : un geste irreversible ne doit
                pas tenir dans un seul clic. */}
            {purge ? (
              <div className="jv-purge">
                <span>Cette action ne se defait pas.</span>
                <button className="oct-btn" onClick={() => setPurge(false)} disabled={busy}>
                  Annuler
                </button>
                <button className="oct-btn jv-rouge" onClick={onPurge} disabled={busy}>
                  {busy ? 'Effacement…' : 'Effacer definitivement'}
                </button>
              </div>
            ) : (
              <button className="oct-btn" onClick={() => setPurge(true)} disabled={busy}>
                Effacer toutes mes donnees
              </button>
            )}
          </section>
        </div>

        <footer className="jv-f-pied">
          <span className="j-dim">
            Les identifiants sont chiffres par le trousseau du systeme et ne remontent jamais a
            l’interface — elle sait qu’ils existent, pas ce qu’ils valent.
          </span>
          <button className="oct-btn" onClick={onFermer}>
            {busy ? 'Enregistrement…' : 'Fermer'}
          </button>
        </footer>
      </div>
    </div>
  )
}
