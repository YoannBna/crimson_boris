import { ModuleSection } from '@/components/ModuleSection'
import { Card, Note } from '@/components/primitives'
import { CopyBlock } from '@/components/CopyBlock'
import { REPLY_TEMPLATES } from '@/data/mail'
import { TASK_DEFS } from '@shared/tasks'
import { useTasks } from '@/lib/useBoris'
import type { ConnectorStatus } from '@shared/config'

/**
 * Monitoring du courrier.
 *
 * Sans connecteur configure, le module ne fabrique pas de faux contenu :
 * il annonce son etat et renvoie vers la configuration. Les modeles de
 * reponse, eux, restent disponibles — ils ne dependent d'aucun compte.
 */
export function M03Courrier({ connector }: { connector: ConnectorStatus | undefined }) {
  const [done, toggle] = useTasks()
  const linked = connector?.state === 'configure'

  return (
    <ModuleSection id="m3" num="03" title="MONITORING DU COURRIER">
      <div className="grid g2">
        <Card full title="✉ Boite principale">
          {linked ? (
            <Note>
              Connecteur relie a <b>{connector?.account}</b>. Le prochain cycle relevera les
              messages porteurs d'action et les classera par criticite.
            </Note>
          ) : (
            <div className="standby">
              <div className="g">✉</div>
              <div className="m">AUCUN CONNECTEUR DE COURRIER</div>
              <div className="s">
                Boris ne lit aucune boite tant qu'aucun acces ne lui a ete confie. Renseigne un
                serveur IMAP et un <b>mot de passe d'application</b> dans la configuration —
                jamais ton mot de passe principal. Les identifiants sont chiffres par le
                trousseau du systeme et ne quittent pas ce poste.
              </div>
            </div>
          )}
        </Card>

        <Card full title="✎ Modeles de reponse">
          {REPLY_TEMPLATES.map((t) => (
            <CopyBlock key={t.id} label={t.label} body={t.body} />
          ))}
          <Note>
            Modeles generiques : les champs entre accolades sont a completer avant envoi. Ni
            l'application ni son depot ne connaissent ton identite.
          </Note>
        </Card>

        <Card full title="⚑ Actions requises & echeances">
          {TASK_DEFS.length === 0 ? (
            <p className="hint">
              Aucune action enregistree. Les echeances alimentent le moteur de gravite : une
              action sans delai non cloturee rend le cycle critique et autorise Boris a se
              manifester.
            </p>
          ) : (
            TASK_DEFS.map((t) => {
              const isDone = done.has(t.id)
              return (
                <div key={t.id} className={`task${isDone ? ' done' : ''}`}>
                  <input type="checkbox" id={t.id} checked={isDone} onChange={() => toggle(t.id)} />
                  <label htmlFor={t.id}>
                    {t.label}
                    <span className="sub2">{t.detail}</span>
                  </label>
                  <span className={`due ${t.dueCls}`}>{t.due}</span>
                </div>
              )
            })
          )}
        </Card>
      </div>
    </ModuleSection>
  )
}
