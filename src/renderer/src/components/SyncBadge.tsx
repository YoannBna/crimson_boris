import { useEffect, useState } from 'react'
import type { SyncState, VersionInfo } from '@shared/version'
import { hasBridge } from '@/lib/useBoris'
import { UpdateModal } from './UpdateModal'

/*
 * Indicateur de synchronisation.
 *
 * Discret par construction : une pastille et un numero dans le coin
 * bas-droit, qui ne s'ouvre qu'au survol ou au clic. Il dit la verite,
 * y compris quand elle est inconfortable — « hors ligne » et
 * « non configure » sont des etats affiches, pas masques derriere un
 * vert rassurant.
 */

const LABEL: Record<SyncState, string> = {
  inconnu: 'verification…',
  verification: 'verification…',
  'a-jour': 'a jour',
  disponible: 'mise a jour disponible',
  telechargement: 'telechargement…',
  prete: 'prete a installer',
  'hors-ligne': 'depot injoignable',
  'non-configure': 'aucun depot declare'
}

const TONE: Record<SyncState, string> = {
  inconnu: 'sy-idle',
  verification: 'sy-idle',
  'a-jour': 'sy-ok',
  disponible: 'sy-new',
  telechargement: 'sy-dl',
  prete: 'sy-ready',
  'hors-ligne': 'sy-warn',
  'non-configure': 'sy-idle'
}

export function SyncBadge() {
  const [info, setInfo] = useState<VersionInfo | null>(null)
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState(false)
  const [busy, setBusy] = useState(false)

  const act = async (fn: () => Promise<void>): Promise<void> => {
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      setInfo((i) =>
        i ? { ...i, detail: err instanceof Error ? err.message : String(err) } : i
      )
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!hasBridge) return
    void window.boris.getVersion().then(setInfo)
    // Le process principal pousse chaque changement d'etat : la
    // progression d'un telechargement doit s'afficher en direct, pas
    // apparaitre d'un bloc une fois l'operation terminee.
    return window.boris.onVersion(setInfo)
  }, [])

  if (!info) return null

  /* Une version en retard appelle une decision : le clic ouvre le
   * panneau de mise a jour. Sinon, il deroule le detail technique. */
  const pending =
    info.state === 'disponible' || info.state === 'telechargement' || info.state === 'prete'

  const stamp =
    info.builtAt === 'dev'
      ? 'developpement'
      : new Date(info.builtAt).toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })

  return (
    <div className={`sync ${TONE[info.state]}${open ? ' open' : ''}`}>
      <button
        className="sync-pill"
        onClick={() => (pending ? setModal(true) : setOpen((v) => !v))}
        title={`Boris ${info.local} — ${LABEL[info.state]}`}
      >
        <span className="sync-dot" />
        <span className="sync-v">v{info.local}</span>
        {info.progress && <span className="sync-pct">{info.progress.percent} %</span>}
      </button>

      {/* Jauge braise, collee sous la pastille : discrete, mais elle rend
          compte d'une operation qui consomme la connexion de l'operateur. */}
      {info.progress && (
        <div className="sync-bar" role="progressbar" aria-valuenow={info.progress.percent}>
          <span style={{ width: `${info.progress.percent}%` }} />
        </div>
      )}

      {open && (
        <div className="sync-panel">
          <div className="sync-row">
            <span>Etat</span>
            <b>{LABEL[info.state]}</b>
          </div>
          <div className="sync-row">
            <span>Version locale</span>
            <b>{info.local}</b>
          </div>
          {info.remote && (
            <div className="sync-row">
              <span>Version publiee</span>
              <b>{info.remote}</b>
            </div>
          )}
          <div className="sync-row">
            <span>Compile le</span>
            <b>{stamp}</b>
          </div>
          <div className="sync-row">
            <span>Verifie a</span>
            <b>
              {info.checkedAt
                ? new Date(info.checkedAt).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : '—'}
            </b>
          </div>

          {info.progress && (
            <div className="sync-row">
              <span>Telecharge</span>
              <b>
                {mb(info.progress.transferred)} / {mb(info.progress.total)}
              </b>
            </div>
          )}

          {info.detail && <div className="sync-detail">{info.detail}</div>}

          {info.autoUpdateBlocker && !info.autoUpdate && (
            <div className="sync-detail sync-blocked">{info.autoUpdateBlocker}</div>
          )}

          {pending ? (
            <button className="sync-install" onClick={() => setModal(true)}>
              Voir la mise a jour
            </button>
          ) : (
            <button
              className="sync-check"
              onClick={() => void window.boris.checkVersion().then(setInfo)}
              disabled={busy}
            >
              Verifier maintenant
            </button>
          )}
        </div>
      )}

      {modal && (
        <UpdateModal
          info={info}
          busy={busy}
          onDownload={() => void act(() => window.boris.downloadUpdate())}
          onInstall={() => void act(() => window.boris.installUpdate())}
          onOpenReleases={() => void act(() => window.boris.openReleases())}
          onClose={() => setModal(false)}
        />
      )}
    </div>
  )
}

/** Octets en mega-octets lisibles. */
function mb(bytes: number): string {
  return `${(bytes / 1048576).toFixed(1)} Mo`
}
