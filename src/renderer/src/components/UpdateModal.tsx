import { useEffect } from 'react'
import type { VersionInfo } from '@shared/version'

/*
 * Panneau de mise a jour.
 *
 * Il montre ce que la version apporte AVANT de consommer quoi que ce
 * soit : les notes publiees, le poids une fois le telechargement lance,
 * et un bouton dont le libelle dit exactement ce qui va se passer.
 *
 * Les notes arrivent en texte brut, converties par le process principal.
 * Elles sont rendues dans un <pre> — jamais interpretees comme du
 * balisage : c'est du contenu distant, il reste du texte.
 */
export function UpdateModal({
  info,
  busy,
  onDownload,
  onInstall,
  onOpenReleases,
  onClose
}: {
  info: VersionInfo
  busy: boolean
  onDownload: () => void
  onInstall: () => void
  onOpenReleases: () => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const downloading = info.state === 'telechargement'
  const ready = info.state === 'prete'

  return (
    <div className="upd-veil" onClick={onClose}>
      <div className="upd-sheet" onClick={(e) => e.stopPropagation()}>
        <header className="upd-head">
          <div>
            <h2>MISE A JOUR DISPONIBLE</h2>
            <span className="upd-jump">
              <b>{info.local}</b> <span className="upd-arrow">→</span>{' '}
              <b className="upd-new">{info.remote}</b>
            </span>
          </div>
          <button className="set-close" onClick={onClose} title="Fermer (Echap)">
            ×
          </button>
        </header>

        <div className="upd-body">
          <div className="upd-label">Notes de version</div>
          {info.releaseNotes ? (
            <pre className="upd-notes">{info.releaseNotes}</pre>
          ) : (
            <p className="upd-empty">
              Aucune note publiee avec cette version.
            </p>
          )}

          {downloading && info.progress && (
            <div className="upd-dl">
              <div className="upd-dl-h">
                <span>Telechargement</span>
                <b>{info.progress.percent} %</b>
              </div>
              <div className="upd-bar">
                <span style={{ width: `${info.progress.percent}%` }} />
              </div>
              <div className="upd-dl-f">
                {mb(info.progress.transferred)} sur {mb(info.progress.total)} ·{' '}
                {mb(info.progress.bytesPerSecond)}/s
              </div>
            </div>
          )}

          {info.action === 'open' && (
            <div className="upd-note-mac">
              Cette application n’est pas signee par un certificat Apple Developer ID : macOS
              refuse d’appliquer une mise a jour en place. Le bouton ouvre la page des versions
              dans ton navigateur — telecharge le nouveau <b>.dmg</b> et remplace l’application.
            </div>
          )}
        </div>

        <footer className="upd-foot">
          <button className="btn ghost" onClick={onClose} disabled={busy}>
            Plus tard
          </button>

          {info.action === 'open' ? (
            <button className="btn upd-go" onClick={onOpenReleases} disabled={busy}>
              Ouvrir la page des versions
            </button>
          ) : ready ? (
            <button className="btn upd-go upd-ready" onClick={onInstall} disabled={busy}>
              Redemarrer et installer
            </button>
          ) : (
            <button className="btn upd-go" onClick={onDownload} disabled={busy || downloading}>
              {downloading ? 'Telechargement…' : 'Telecharger et installer'}
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}

function mb(bytes: number): string {
  return `${(bytes / 1048576).toFixed(1)} Mo`
}
