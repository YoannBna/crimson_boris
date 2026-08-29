import { useEffect, useState } from 'react'
import type { AppConfig } from '@shared/config'
import type { CoreStatus } from '@shared/types'
import { TASK_DEFS } from '@shared/tasks'
import { REPLY_TEMPLATES } from '@/data/mail'
import { Bloc } from '@/forge/VoletAnalyse'
import { hasBridge, useMarkets, useTasks } from '@/lib/useBoris'
import type { NodeDef } from '@/nav/map'
import { Asymetries } from './Asymetries'
import { Marches } from './Marches'

/* ============================================================
   Mode OPTI — un volet par categorie
   ============================================================ */

/**
 * Aucun de ces volets n'invente de contenu.
 *
 * Quand rien n'est configure, ils disent ce qui manque et ou le
 * renseigner. Une fausse actualite ou une boite de reception simulee
 * seraient pires que l'aveu : elles se croiraient un moment.
 */
export function OptiVolet({ noeud }: { noeud: NodeDef | null }) {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [status, setStatus] = useState<CoreStatus | null>(null)
  const markets = useMarkets()

  useEffect(() => {
    if (!hasBridge) return
    void window.boris.config.get().then(setConfig)
    void window.boris.getStatus().then(setStatus)
    return window.boris.onStatus(setStatus)
  }, [])

  if (noeud === null) return null

  return (
    <div className="opti-work" onClick={(e) => e.stopPropagation()}>
      <section className="oct oct-cold opti-panneau">
        <header className="opti-head">
          <span className="j-title">{noeud.label}</span>
          <span className="j-dim">{noeud.role}</span>
        </header>

        <div className="opti-corps">
          {noeud.id === 'marches' && (
            <Marches snapshot={markets} hits={status?.hits ?? []} />
          )}
          {noeud.id === 'asymetries' && <Asymetries snapshot={markets} />}
          {noeud.id === 'veille' && <Veille config={config} />}
          {noeud.id === 'courrier' && <Courrier config={config} />}
          {noeud.id === 'actions' && <Actions status={status} />}
        </div>
      </section>
    </div>
  )
}

/* --- Veille ------------------------------------------------- */

function Veille({ config }: { config: AppConfig | null }) {
  const feeds = config?.profile.feeds ?? []

  return (
    <div className="vp">
      <Bloc titre={`Flux surveillés · ${feeds.length}`} ton="froid">
        {feeds.length === 0 ? (
          <p className="j-body">
            Aucun flux déclaré. Boris n'invente pas d'actualité : déclare les flux RSS ou Atom
            que tu veux suivre dans le profil, et ils seront relevés à chaque cycle, classés par
            récurrence et croisés avec le radar financier.
          </p>
        ) : (
          feeds.map((f) => (
            <div className="vp-item" key={f}>
              <div className="vp-t">{hote(f)}</div>
              <div className="vp-m">{f}</div>
            </div>
          ))
        )}
      </Bloc>
    </div>
  )
}

function hote(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/* --- Courrier ----------------------------------------------- */

function Courrier({ config }: { config: AppConfig | null }) {
  const mail = config?.connectors.find((c) => c.id === 'mail')
  const relie = mail?.state === 'configure'
  const [copie, setCopie] = useState<string | null>(null)

  return (
    <div className="vp">
      <Bloc titre="Boîte principale" ton="froid">
        {relie ? (
          <div className="vp-item vp-ok">
            <div className="vp-t">Connecteur relié</div>
            <div className="vp-m">
              Compte <b>{mail?.account}</b>. Le prochain cycle relèvera les messages porteurs
              d'action et les classera par criticité.
            </div>
          </div>
        ) : (
          <p className="j-body">
            Boris ne lit aucune boîte tant qu'aucun accès ne lui a été confié. Renseigne un
            serveur IMAP et un <b>mot de passe d'application</b> dans le profil — jamais ton mot
            de passe principal. Les identifiants sont chiffrés par le trousseau du système et ne
            quittent pas ce poste.
          </p>
        )}
      </Bloc>

      <Bloc titre={`Modèles de réponse · ${REPLY_TEMPLATES.length}`} ton="froid">
        {REPLY_TEMPLATES.map((t) => (
          <div className="mod" key={t.id}>
            <div className="mod-h">
              <span className="mod-l">{t.label}</span>
              <button
                className="mod-c"
                onClick={() => {
                  void navigator.clipboard.writeText(t.body).then(() => {
                    setCopie(t.id)
                    setTimeout(() => setCopie((c) => (c === t.id ? null : c)), 1800)
                  })
                }}
              >
                {copie === t.id ? 'copié' : 'copier'}
              </button>
            </div>
            <pre className="mod-b">{t.body}</pre>
          </div>
        ))}
        <p className="vp-note j-dim">
          Les champs entre accolades restent à compléter : ni l'application ni son dépôt ne
          connaissent ton identité.
        </p>
      </Bloc>
    </div>
  )
}

/* --- Actions ------------------------------------------------ */

function Actions({ status }: { status: CoreStatus | null }) {
  const [done, toggle] = useTasks()
  const hits = status?.hits.filter((h) => h.rule !== 'market-shock') ?? []

  return (
    <div className="vp">
      <Bloc titre={`Échéances · ${TASK_DEFS.length}`} ton="froid">
        {TASK_DEFS.length === 0 ? (
          <p className="j-body">
            Aucune action enregistrée. Les tâches appartiennent à l'opérateur, pas à
            l'application : elles arrivent par le connecteur de courrier une fois celui-ci
            configuré.
          </p>
        ) : (
          TASK_DEFS.map((t) => (
            <label className={`tache${done.has(t.id) ? ' faite' : ''}`} key={t.id}>
              <input type="checkbox" checked={done.has(t.id)} onChange={() => toggle(t.id)} />
              <span className="tache-b">
                <span className="tache-l">{t.label}</span>
                <span className="tache-d">{t.detail}</span>
              </span>
              <span className={`tache-e due-${t.dueCls}`}>{t.due}</span>
            </label>
          ))
        )}
      </Bloc>

      <Bloc titre={`Signaux du dernier cycle · ${hits.length}`} ton="chaud">
        {hits.length === 0 ? (
          <p className="j-body">Rien à signaler au dernier cycle.</p>
        ) : (
          hits.map((h) => (
            <div
              className={`vp-item ${h.severity === 'critical' ? 'g-crit' : 'g-hot'}`}
              key={`${h.rule}-${h.label}`}
            >
              <div className="vp-t">
                <span className="vp-g">{h.rule}</span>
                {h.label}
              </div>
              <div className="vp-m">{h.detail}</div>
            </div>
          ))
        )}
      </Bloc>

      {status && (
        <Bloc titre="Cycle" ton="froid">
          <div className="vs-grille">
            <Mesure v={horo(status.lastCycle)} l="dernier cycle" />
            <Mesure v={horo(status.nextCycle)} l="prochain cycle" />
            <Mesure
              v={status.lastDurationMs === null ? '—' : `${(status.lastDurationMs / 1000).toFixed(1)} s`}
              l="durée du dernier"
            />
            <Mesure v={`${status.modulesFed}/${status.modulesTotal}`} l="modules alimentés" />
          </div>
        </Bloc>
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

function horo(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
