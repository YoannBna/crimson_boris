import { useState } from 'react'
import type { AppConfig, ConnectorId } from '@shared/config'
import { ConnectorFields } from './components/ConnectorFields'

/*
 * Panneau d'accueil.
 *
 * Il barre l'acces au tableau de bord tant que l'operateur n'a pas
 * arrete sa configuration. Chaque connecteur peut etre renseigne ou
 * ecarte : Boris fonctionne sans aucun d'eux, en degrade, et le dit.
 */

const CONNECTORS: {
  id: ConnectorId
  title: string
  role: string
  note: string
}[] = [
  {
    id: 'mail',
    title: 'Courrier',
    role: 'Releve les messages porteurs d’action et les classe par criticite.',
    note:
      'Utilise un mot de passe d’application dedie, jamais ton mot de passe principal. Il est chiffre par le trousseau du systeme et ne quitte pas ce poste.'
  },
  {
    id: 'markets',
    title: 'Flux financiers',
    role: 'Releve les cotations et surveille les seuils de choc.',
    note:
      'La source par defaut est publique et ne demande aucune cle. Renseigne-en une seulement si tu veux passer par ton propre fournisseur.'
  },
  {
    id: 'archidekt',
    title: 'Archidekt',
    role: 'Importe tes listes de cartes dans la Forge.',
    note:
      'Facultatif : l’import par fichier fonctionne sans compte. Le jeton ne sert qu’aux decks prives.'
  }
]

export function Onboarding({
  config,
  onSecret,
  onSkip,
  onProfile,
  onComplete,
  busy,
  error
}: {
  config: AppConfig
  onSecret: (c: ConnectorId, key: string, value: string) => void
  onSkip: (c: ConnectorId) => void
  onProfile: (name: string) => void
  onComplete: () => void
  busy: boolean
  error: string | null
}) {
  const [name, setName] = useState(config.profile.displayName)

  return (
    <div className="onb">
      <div className="onb-sheet">
        <header className="onb-head">
          <h1>CRIMSON BORIS</h1>
          <span className="sub">// Noyau Analytique &amp; Executif</span>
          <p className="onb-intro">
            Boris ne connait rien de toi et ne cherche pas a l’apprendre. Tout ce que tu
            renseignes ici reste sur ce poste : les reglages en clair dans une base locale, les
            identifiants chiffres par le trousseau du systeme. Rien n’est transmis a un serveur,
            rien n’est collecte, rien ne part sur un depot.
          </p>
        </header>

        {!config.secureStorageAvailable && (
          <div className="onb-warn">
            ⚠ Le trousseau du systeme est indisponible sur cette session. Boris{' '}
            <b>refusera d’enregistrer un identifiant</b> plutot que de l’ecrire en clair. Les
            connecteurs resteront hors service ; le reste fonctionne normalement.
          </div>
        )}

        <section className="onb-block">
          <div className="onb-label">Operateur</div>
          <input
            className="onb-input"
            value={name}
            placeholder="Nom affiche dans le bandeau — libre, jamais transmis"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => onProfile(name)}
          />
        </section>

        {CONNECTORS.map((c) => {
          const status = config.connectors.find((x) => x.id === c.id)
          const state = status?.state ?? 'absent'

          return (
            <section className={`onb-block onb-${state}`} key={c.id}>
              <div className="onb-block-h">
                <span className="onb-label">{c.title}</span>
                <span className={`onb-state st-${state}`}>
                  {state === 'configure'
                    ? `relie${status?.account ? ` · ${status.account}` : ''}`
                    : state === 'ignore'
                      ? 'ecarte'
                      : 'non configure'}
                </span>
              </div>
              <p className="onb-role">{c.role}</p>

              <ConnectorFields
                id={c.id}
                status={status}
                onSecret={onSecret}
                busy={busy}
                editable={false}
              />

              {state !== 'configure' && (
                <div className="onb-actions">
                  <button className="btn ghost" onClick={() => onSkip(c.id)} disabled={busy}>
                    Passer pour l’instant
                  </button>
                </div>
              )}

              <p className="onb-note">{c.note}</p>
            </section>
          )
        })}

        {error && <div className="onb-warn">⚠ {error}</div>}

        <footer className="onb-foot">
          <p className="onb-legal">
            Aucune donnee ne quitte ce poste. Rien n’est definitif : tout se modifie ensuite
            depuis <b>Profil &amp; parametres</b>, accessible en permanence depuis le bandeau.
          </p>
          <button className="btn onb-go" onClick={onComplete} disabled={busy}>
            {busy ? 'Enregistrement…' : 'Ouvrir le terminal'}
          </button>
        </footer>
      </div>
    </div>
  )
}
