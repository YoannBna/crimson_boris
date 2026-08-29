import { useEffect, useState } from 'react'
import type { SyncState, VersionInfo } from '@shared/version'
import { hasBridge } from '@/lib/useBoris'
import { UpdateModal } from '@/components/UpdateModal'

/* ============================================================
   Indicateur de version
   ============================================================ */

/**
 * La pastille dit la verite, y compris quand elle est inconfortable :
 * « depot injoignable » et « aucun depot declare » sont des etats
 * affiches, pas masques derriere un vert rassurant.
 *
 * Le panneau de mise a jour n'est pas reecrit : il porte la decision de
 * ce qui s'affiche selon la plateforme — telecharger sous Windows,
 * ouvrir la page des versions sous macOS faute de signature. Deux
 * copies de cette regle auraient fini par diverger. Il est seulement
 * rhabille, dans `.jv-skin`.
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

const TON: Record<SyncState, string> = {
  inconnu: 'v-idle',
  verification: 'v-idle',
  'a-jour': 'v-ok',
  disponible: 'v-new',
  telechargement: 'v-dl',
  prete: 'v-ready',
  'hors-ligne': 'v-warn',
  'non-configure': 'v-idle'
}

export function Version() {
  const [info, setInfo] = useState<VersionInfo | null>(null)
  const [ouvert, setOuvert] = useState(false)
  const [modal, setModal] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!hasBridge) return
    void window.boris.getVersion().then(setInfo)
    // Le process principal pousse chaque changement : la progression
    // d'un telechargement doit s'afficher en direct.
    return window.boris.onVersion(setInfo)
  }, [])

  if (!info) return null

  const act = async (fn: () => Promise<void>): Promise<void> => {
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      setInfo((i) => (i ? { ...i, detail: err instanceof Error ? err.message : String(err) } : i))
    } finally {
      setBusy(false)
    }
  }

  const attente =
    info.state === 'disponible' || info.state === 'telechargement' || info.state === 'prete'

  return (
    <div className={`jv-version ${TON[info.state]}`} onClick={(e) => e.stopPropagation()}>
      <button
        className="jv-pill"
        onClick={() => (attente ? setModal(true) : setOuvert((v) => !v))}
        title={`Boris ${info.local} — ${LABEL[info.state]}`}
      >
        <span className="jv-dot" />
        <span className="jv-num">v{info.local}</span>
        {info.progress && <span className="jv-pct">{info.progress.percent} %</span>}
      </button>

      {info.progress && (
        <div className="jv-jauge" role="progressbar" aria-valuenow={info.progress.percent}>
          <span style={{ width: `${info.progress.percent}%` }} />
        </div>
      )}

      {ouvert && (
        <div className="jv-detail oct oct-s">
          <Ligne t="Etat" v={LABEL[info.state]} />
          <Ligne t="Version locale" v={info.local} />
          {info.remote && <Ligne t="Version publiee" v={info.remote} />}
          <Ligne t="Compile le" v={horodate(info.builtAt)} />
          <Ligne
            t="Verifie a"
            v={
              info.checkedAt
                ? new Date(info.checkedAt).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : '—'
            }
          />
          {info.detail && <div className="jv-note">{info.detail}</div>}
          {/* En developpement, les deux champs portent la meme phrase.
              La repeter ne la rend pas plus vraie. */}
          {info.autoUpdateBlocker && !info.autoUpdate && info.autoUpdateBlocker !== info.detail && (
            <div className="jv-note jv-bloque">{info.autoUpdateBlocker}</div>
          )}
          <button
            className="oct-btn"
            disabled={busy}
            onClick={() => void window.boris.checkVersion().then(setInfo)}
          >
            {busy ? 'Verification…' : 'Verifier maintenant'}
          </button>
        </div>
      )}

      {modal && (
        <div className="jv-skin">
          <UpdateModal
            info={info}
            busy={busy}
            onDownload={() => void act(() => window.boris.downloadUpdate())}
            onInstall={() => void act(() => window.boris.installUpdate())}
            onOpenReleases={() => void act(() => window.boris.openReleases())}
            onClose={() => setModal(false)}
          />
        </div>
      )}
    </div>
  )
}

function Ligne({ t, v }: { t: string; v: string }) {
  return (
    <div className="jv-ligne">
      <span>{t}</span>
      <b>{v}</b>
    </div>
  )
}

function horodate(iso: string): string {
  if (iso === 'dev') return 'developpement'
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
