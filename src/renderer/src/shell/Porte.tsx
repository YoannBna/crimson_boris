import { useState } from 'react'
import type { AppConfig, ConnectorId } from '@shared/config'
import { ConnectorFields } from '@/components/ConnectorFields'
import { Aura } from '@/components/Aura'
import { BorisAvatar } from '@/components/BorisAvatar'

/* ============================================================
   Porte d'entree
   ============================================================ */

/**
 * Elle barre la coquille tant que la configuration n'est pas arretee.
 *
 * Chaque connecteur peut etre renseigne ou ecarte : Boris fonctionne
 * sans aucun d'eux, en degrade, et le dit. Ecarter n'est pas subir —
 * c'est le seul moyen d'entrer sans confier ce qu'on ne veut pas
 * confier.
 */

const CONNECTEURS: {
  id: ConnectorId
  titre: string
  role: string
  note: string
}[] = [
  {
    id: 'mail',
    titre: 'Courrier',
    role: 'Releve les messages porteurs d’action et les classe par criticite.',
    note:
      'Un mot de passe d’application dedie, jamais ton mot de passe principal. Il est chiffre par le trousseau du systeme et ne quitte pas ce poste.'
  },
  {
    id: 'markets',
    titre: 'Flux financiers',
    role: 'Releve les cotations et surveille les seuils de choc.',
    note:
      'La source par defaut est publique et ne demande aucune cle. N’en renseigne une que pour passer par ton propre fournisseur.'
  },
  {
    id: 'archidekt',
    titre: 'Archidekt',
    role: 'Importe tes listes de cartes dans la Forge.',
    note: 'Facultatif : l’import par fichier fonctionne sans compte. Le jeton ne sert qu’aux decks prives.'
  }
]

export function Porte({
  config,
  busy,
  error,
  onSecret,
  onSkip,
  onProfile,
  onComplete
}: {
  config: AppConfig
  busy: boolean
  error: string | null
  onSecret: (c: ConnectorId, key: string, value: string) => void
  onSkip: (c: ConnectorId) => void
  onProfile: (name: string) => void
  onComplete: () => void
}) {
  const [nom, setNom] = useState(config.profile.displayName)

  return (
    <div className="jarvis jv-porte">
      <Aura />

      <div className="jv-p-feuille oct">
        <header className="jv-p-head">
          <BorisAvatar size={104} />
          <div className="jv-p-titre">
            <span className="j-title">Crimson Boris</span>
            <span className="j-dim">noyau analytique &amp; executif</span>
          </div>
          <p className="j-body">
            Boris ne connait rien de toi et ne cherche pas a l’apprendre. Tout ce que tu
            renseignes ici reste sur ce poste : les reglages en clair dans une base locale, les
            identifiants chiffres par le trousseau du systeme. Rien n’est transmis, rien n’est
            collecte.
          </p>
        </header>

        <div className="jv-p-corps">
          {!config.secureStorageAvailable && (
            <div className="jv-alerte">
              Le trousseau du systeme est indisponible sur cette session. Boris{' '}
              <b>refusera d’enregistrer un identifiant</b> plutot que de l’ecrire en clair. Les
              connecteurs resteront hors service ; le reste fonctionne normalement.
            </div>
          )}

          <section className="jv-bloc">
            <div className="jv-bloc-t">Operateur</div>
            <input
              className="onb-input"
              value={nom}
              placeholder="Nom affiche a l’accueil — libre, jamais transmis"
              onChange={(e) => setNom(e.target.value)}
              onBlur={() => onProfile(nom)}
            />
          </section>

          {CONNECTEURS.map((c) => {
            const status = config.connectors.find((x) => x.id === c.id)
            const etat = status?.state ?? 'absent'
            return (
              <section className="jv-bloc" key={c.id}>
                <div className="jv-bloc-h">
                  <span className="jv-bloc-t">{c.titre}</span>
                  <span className={`jv-etat e-${etat}`}>
                    {etat === 'configure'
                      ? `relie${status?.account ? ` · ${status.account}` : ''}`
                      : etat === 'ignore'
                        ? 'ecarte'
                        : 'non configure'}
                  </span>
                </div>
                <p className="jv-bloc-r">{c.role}</p>

                <ConnectorFields
                  id={c.id}
                  status={status}
                  onSecret={onSecret}
                  busy={busy}
                  editable={false}
                />

                {etat !== 'configure' && (
                  <button className="oct-btn" onClick={() => onSkip(c.id)} disabled={busy}>
                    Passer pour l’instant
                  </button>
                )}

                <p className="jv-bloc-n">{c.note}</p>
              </section>
            )
          })}

          {error && <div className="jv-alerte">{error}</div>}
        </div>

        <footer className="jv-p-pied">
          <span className="j-dim">
            Rien n’est definitif : tout se modifie ensuite depuis <b>Profil &amp; parametres</b>,
            accessible en permanence.
          </span>
          <button className="oct-btn oct-btn-warm" onClick={onComplete} disabled={busy}>
            {busy ? 'Enregistrement…' : 'Entrer'}
          </button>
        </footer>
      </div>
    </div>
  )
}
